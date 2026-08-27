import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Database } from "./index";
import { db as defaultDb } from "./index";
import {
  accounts, auditEvents, ledger, listMembers, ledger as ledgerTable,
  outreach, people, pipelineItems, pipelines, requests, sendAttempts,
} from "./schema";
import { canSend, poolFor, type SendRequest } from "../gate";
import { generateDraft } from "../sourcing";
import { loadRequestContext } from "./loaders";
import type {
  Account, Brief, Channel, Db, ItemStatus, PipelineSource, RequestStatus, Role,
} from "../types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function audit(
  tx: Tx, actor: string, entity: string, action: string, detail = "",
): Promise<void> {
  await tx.insert(auditEvents).values({ actor, entity, action, detail });
}

export async function createRequest(
  input: { accountId: string; rawText: string; brief: Brief; slaHours: number; assignedAm?: string },
  database: Database = defaultDb,
): Promise<string> {
  return database.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
    if (!account) throw new Error(`unknown account ${input.accountId}`);

    const [row] = await tx.insert(requests).values({
      accountId: input.accountId,
      requesterName: account.displayName,
      requesterInitial: account.initial,
      rawText: input.rawText,
      status: "intent_review",
      goalType: input.brief.goalType,
      brief: input.brief,
      assignedAm: input.assignedAm,
      dueAt: new Date(Date.now() + input.slaHours * 3600_000).toISOString(),
    }).returning();

    await audit(tx, account.displayName, row.id, "request.created", `عبر ${input.brief.extractedBy}`);
    return row.id;
  });
}

/** Confirms the brief and generates the first draft in one transaction. */
export async function confirmBrief(
  requestId: string,
  summaryAr: string | undefined,
  database: Database = defaultDb,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [request] = await tx.select().from(requests).where(eq(requests.id, requestId)).limit(1);
    if (!request?.brief) return;

    const brief = request.brief as Brief;
    if (summaryAr) brief.summaryAr = summaryAr;

    await tx.update(requests).set({
      brief,
      status: "in_sourcing" as RequestStatus,
      confirmedAt: new Date().toISOString(),
    }).where(eq(requests.id, requestId));

    const allPeople = (await tx.select().from(people)).map(
      (p) => ({ ...p, linkedinUrl: p.linkedinUrl ?? undefined, email: p.email ?? undefined }),
    ) as Db["people"];

    const drafted = generateDraft(brief, allPeople);

    const [pipeline] = await tx.insert(pipelines).values({
      requestId, version: 1, source: "ai_generated", status: "draft", createdBy: "AI",
    }).returning();

    if (drafted.length) {
      await tx.insert(pipelineItems).values(
        drafted.map((it) => ({ ...it, pipelineId: pipeline.id })),
      );
    }

    await audit(tx, request.requesterName, requestId, "brief.confirmed",
      `مسودة آلية بـ${drafted.length} أشخاص`);
  });
}

export async function setItemStatus(
  pipelineId: string, itemId: string, status: ItemStatus, actor: string,
  database: Database = defaultDb,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [item] = await tx.select().from(pipelineItems)
      .where(and(eq(pipelineItems.id, itemId), eq(pipelineItems.pipelineId, pipelineId))).limit(1);
    if (!item) return;

    // The evidence gate: a row with no sourced claim cannot be approved.
    if (status === "approved" && (item.evidence ?? []).length === 0) return;

    const next = item.status === status ? "proposed" : status;
    await tx.update(pipelineItems).set({ status: next }).where(eq(pipelineItems.id, itemId));

    const [pipeline] = await tx.select().from(pipelines).where(eq(pipelines.id, pipelineId)).limit(1);
    if (pipeline) await audit(tx, actor, pipeline.requestId, `item.${next}`, item.personId);
  });
}

/**
 * Keeps only approved rows, publishes, and supersedes every other version —
 * so exactly one version is live per request and nothing was silently
 * force-approved on the way out.
 */
export async function publishPipeline(
  pipelineId: string, actor: string, database: Database = defaultDb,
): Promise<string | null> {
  return database.transaction(async (tx) => {
    const [pipeline] = await tx.select().from(pipelines).where(eq(pipelines.id, pipelineId)).limit(1);
    if (!pipeline) return null;

    const items = await tx.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId));
    const approved = items.filter((i) => i.status === "approved");
    if (approved.length === 0) return null;

    const dropped = items.filter((i) => i.status !== "approved").map((i) => i.id);
    if (dropped.length) {
      await tx.delete(pipelineItems).where(inArray(pipelineItems.id, dropped));
    }
    for (const [index, item] of approved.entries()) {
      await tx.update(pipelineItems).set({ rank: index + 1 }).where(eq(pipelineItems.id, item.id));
    }

    await tx.update(pipelines)
      .set({ status: "published", publishedAt: new Date().toISOString() })
      .where(eq(pipelines.id, pipelineId));

    await tx.update(pipelines).set({ status: "superseded" }).where(
      and(
        eq(pipelines.requestId, pipeline.requestId),
        ne(pipelines.id, pipelineId),
        ne(pipelines.status, "superseded"),
      ),
    );

    await tx.update(requests).set({ status: "pipeline_ready" as RequestStatus })
      .where(and(eq(requests.id, pipeline.requestId), eq(requests.status, "in_sourcing")));

    await audit(tx, actor, pipeline.requestId, "pipeline.published", `النسخة ${pipeline.version}`);
    return pipeline.requestId;
  });
}

export interface AttachRow {
  latin: string; title: string; company: string;
  linkedinUrl?: string; email?: string;
}

/** Dedupes on LinkedIn URL, then email, then name+company. */
async function upsertPerson(tx: Tx, row: AttachRow, source: "am" | "import"): Promise<string> {
  const norm = (s?: string) => s?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const existing = await tx.select().from(people);
  const match = existing.find(
    (p) =>
      (row.linkedinUrl && norm(p.linkedinUrl ?? undefined) === norm(row.linkedinUrl)) ||
      (row.email && p.email?.toLowerCase() === row.email.toLowerCase()) ||
      (p.latin.toLowerCase() === row.latin.toLowerCase() && p.company === row.company),
  );
  if (match) return match.id;

  const [created] = await tx.insert(people).values({
    latin: row.latin,
    firstAr: row.latin.split(" ")[0] ?? row.latin,
    title: row.title, company: row.company, geo: "—",
    industries: [], seniority: "unknown",
    linkedinUrl: row.linkedinUrl, email: row.email,
    emailVerified: Boolean(row.email), openToIntros: false, source,
  }).returning();
  return created.id;
}

const SOURCE_LABEL: Record<PipelineSource, string> = {
  ai_generated: "مُولّدة آليًا", manual: "يدوي",
  imported_csv: "ملف مرفوع", pasted: "صفوف ملصقة", from_list: "قائمة جاهزة",
};

export async function attachPipeline(
  input: { requestId: string; source: PipelineSource; rows?: AttachRow[]; listId?: string; actor: string },
  database: Database = defaultDb,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [request] = await tx.select().from(requests).where(eq(requests.id, input.requestId)).limit(1);
    if (!request) return;

    let personIds: string[] = [];
    if (input.source === "from_list" && input.listId) {
      personIds = (await tx.select().from(listMembers).where(eq(listMembers.listId, input.listId)))
        .map((m) => m.personId);
    } else {
      const kind = input.source === "imported_csv" ? "import" : "am";
      for (const row of input.rows ?? []) personIds.push(await upsertPerson(tx, row, kind));
    }
    if (personIds.length === 0) return;

    const versions = await tx.select({ v: pipelines.version }).from(pipelines)
      .where(eq(pipelines.requestId, input.requestId));
    const version = Math.max(0, ...versions.map((r) => r.v)) + 1;

    const [pipeline] = await tx.insert(pipelines).values({
      requestId: input.requestId, version, source: input.source,
      status: "draft", createdBy: input.actor,
    }).returning();

    const rows = await tx.select().from(people).where(inArray(people.id, personIds));
    await tx.insert(pipelineItems).values(
      personIds.map((personId, index) => ({
        pipelineId: pipeline.id, personId, rank: index + 1,
        fit: "medium" as const, thin: false,
        why: "أضافها مدير الحساب بعد مراجعة الطلب.",
        whyNow: "—", roleRelevance: "—", companyRelevance: "—", timing: "—",
        leadWith: "—", avoid: "—", opener: "",
        channel: (rows.find((p) => p.id === personId)?.emailVerified ? "email" : "linkedin") as Channel,
        status: "approved" as const,
        evidence: [{
          url: "", title: "بناها مدير الحساب يدويًا",
          source: SOURCE_LABEL[input.source], date: "اليوم", assertedBy: "am" as const,
        }],
        generatedBy: "am" as const,
      })),
    );

    await audit(tx, input.actor, input.requestId, "pipeline.attached",
      `النسخة ${version} من ${SOURCE_LABEL[input.source]}`);
  });
}

export interface SendOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * The money path.
 *
 * A transaction alone is not enough: two concurrent sends can each read a
 * balance of one and each debit it. The account row is locked FOR UPDATE
 * before the gate runs, so the second send waits and then sees the debited
 * balance and is refused.
 *
 * Both verdicts are recorded — a refusal is as auditable as a send.
 */
export async function recordSend(
  input: SendRequest & { actor: string },
  database: Database = defaultDb,
): Promise<SendOutcome> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${accounts} where ${accounts.id} = ${input.accountId} for update`,
    );

    const context = await loadRequestContext(input.requestId, tx as unknown as Database);
    const verdict = canSend(context, input);

    await tx.insert(sendAttempts).values({
      accountId: input.accountId,
      requestId: input.requestId,
      personId: input.personId,
      pool: verdict.pool,
      channel: input.channel,
      body: input.body,
      variantHash: verdict.variantHash,
      result: verdict.allowed ? "allowed" : "refused",
      gateFailures: verdict.failures,
    });

    if (!verdict.allowed) {
      await audit(tx, input.actor, input.requestId, "send.refused", verdict.failures.join(","));
      return { ok: false, reason: verdict.reason };
    }

    await tx.insert(ledgerTable).values({
      accountId: input.accountId, delta: -1, reason: "send", ref: input.personId,
    });

    await tx.insert(outreach).values({
      requestId: input.requestId, personId: input.personId,
      channel: input.channel, status: "sent",
    }).onConflictDoUpdate({
      target: [outreach.requestId, outreach.personId],
      set: { status: "sent", channel: input.channel, updatedAt: new Date().toISOString() },
    });

    await tx.update(requests).set({ status: "outreach" as RequestStatus })
      .where(and(eq(requests.id, input.requestId), eq(requests.status, "pipeline_ready")));

    await audit(tx, input.actor, input.requestId, "send.allowed",
      `${poolFor(input.channel)}:${input.personId}`);
    return { ok: true };
  });
}

/** Development-only: stands in for verification and a credit purchase. */
export async function verifyAndGrant(
  accountId: string, amount: number, database: Database = defaultDb,
): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.update(accounts)
      .set({ state: "verified", verifiedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));

    // ref is fixed, so the ledger's unique index makes repeated grants a no-op
    // rather than free credits.
    await tx.insert(ledger)
      .values({ accountId, delta: amount, reason: "grant", ref: "dev-grant" })
      .onConflictDoNothing();

    await audit(tx, "dev", accountId, "account.verified", `dev grant of ${amount} credits`);
  });
}

/** Why a verification was refused, so the caller can say something useful. */
export type VerifyResult =
  | { ok: true; granted: boolean }
  | { ok: false; reason: "unknown_account" };

/**
 * Verifies an account for sending and puts credits in its ledger.
 *
 * The production counterpart to verifyAndGrant, which stays dev-only. The
 * difference that matters is `ref`: verifyAndGrant hardcodes "dev-grant", so
 * ledger_idempotency_idx makes a second grant a silent no-op — right for a
 * dev tool that may run on every restart, wrong here, where it would mean an
 * account can be topped up exactly once and never again. A caller-supplied ref
 * keeps a double-submitted form safe while leaving a later top-up possible.
 *
 * `granted` reports which of the two happened, so the page can say "credits
 * added" rather than implying it when the index absorbed a repeat.
 */
export async function verifyAndCredit(
  input: { accountId: string; amount: number; ref: string; actor: string },
  database: Database = defaultDb,
): Promise<VerifyResult> {
  return database.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: accounts.id }).from(accounts)
      .where(eq(accounts.id, input.accountId)).limit(1);
    if (!account) return { ok: false as const, reason: "unknown_account" as const };

    await tx.update(accounts)
      .set({ state: "verified", verifiedAt: new Date().toISOString() })
      .where(eq(accounts.id, input.accountId));

    const inserted = await tx.insert(ledgerTable)
      .values({ accountId: input.accountId, delta: input.amount, reason: "grant", ref: input.ref })
      .onConflictDoNothing()
      .returning({ id: ledgerTable.id });

    await audit(tx, input.actor, input.accountId, "account.verified",
      inserted.length
        ? `verified and granted ${input.amount} credits (${input.ref})`
        : `verified; grant ${input.ref} already applied`);

    return { ok: true as const, granted: inserted.length > 0 };
  });
}

/**
 * Credit standing by account, for the team page.
 *
 * balanceOf in lib/credits.ts sums an in-memory Db, which is right for the
 * gate — it already holds the one account's ledger. Listing every account
 * would otherwise mean loading every ledger row to add them up.
 *
 * `grants` counts grant rows rather than summing them, because it is what the
 * page turns into the next grant's ref. A count only ever goes up, so a
 * re-rendered page always produces a ref that has not been used, while a
 * double-submitted one repeats the ref it was rendered with and is absorbed.
 * A balance would not do: credits are spent as well as granted, so the same
 * balance can recur and would swallow a legitimate top-up.
 */
export type CreditStanding = { balance: number; grants: number };

export async function creditStanding(
  database: Database = defaultDb,
): Promise<Map<string, CreditStanding>> {
  const rows = await database
    .select({
      accountId: ledgerTable.accountId,
      balance: sql<number>`sum(${ledgerTable.delta})::int`,
      grants: sql<number>`count(*) filter (where ${ledgerTable.reason} = 'grant')::int`,
    })
    .from(ledgerTable)
    .groupBy(ledgerTable.accountId);
  return new Map(
    rows.map((r) => [r.accountId, { balance: Number(r.balance ?? 0), grants: Number(r.grants ?? 0) }]),
  );
}

/** Why a role change was refused, so the caller can say something useful. */
export type RoleChangeResult =
  | { ok: true }
  | { ok: false; reason: "unknown_account" | "self" | "last_admin" };

/**
 * Changes an account's role.
 *
 * Both refusals live inside the transaction rather than on the page, because
 * the page is not the only caller: `grantRole` is a server action, which is a
 * POST endpoint anyone can invoke without ever loading a screen. A check that
 * only guards the form guards nothing.
 */
export async function setAccountRole(
  input: { actorAccountId: string; targetAccountId: string; role: Role },
  database: Database = defaultDb,
): Promise<RoleChangeResult> {
  return database.transaction(async (tx) => {
    // An admin demoting themselves is almost always a misclick, and it is the
    // easiest way to trip the last-admin rule below by accident.
    if (input.actorAccountId === input.targetAccountId) return { ok: false, reason: "self" };

    const [target] = await tx
      .select().from(accounts).where(eq(accounts.id, input.targetAccountId)).limit(1);
    if (!target) return { ok: false, reason: "unknown_account" };
    if (target.role === input.role) return { ok: true };

    if (target.role === "admin" && input.role !== "admin") {
      // Locking every administrator out of /am leaves no in-app way back —
      // the same shape of failure as a migration that reports success while
      // doing nothing. Counted inside the transaction so a concurrent demotion
      // of the other last admin cannot slip between the count and the write.
      const remaining = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.role, "admin"), ne(accounts.id, input.targetAccountId)));
      if (remaining.length === 0) return { ok: false, reason: "last_admin" };
    }

    const [actor] = await tx
      .select().from(accounts).where(eq(accounts.id, input.actorAccountId)).limit(1);

    await tx.update(accounts).set({ role: input.role }).where(eq(accounts.id, target.id));
    await tx.insert(auditEvents).values({
      actor: actor?.displayName ?? input.actorAccountId,
      entity: target.id,
      action: `role.${input.role}`,
      detail: `${target.email}: ${target.role} → ${input.role}`,
    });

    return { ok: true };
  });
}

/** Every account, for the team screen. */
export async function listAccounts(database: Database = defaultDb): Promise<Account[]> {
  const rows = await database.select().from(accounts).orderBy(accounts.createdAt);
  return rows.map((row) => ({
    ...row,
    verifiedAt: row.verifiedAt ?? undefined,
    frozenAt: row.frozenAt ?? undefined,
    frozenReason: row.frozenReason ?? undefined,
    assignedAm: row.assignedAm ?? undefined,
  }));
}
