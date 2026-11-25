import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "./index";
import { db as defaultDb } from "./index";
import {
  accounts, auditEvents, ledger, listMembers, outreach, people, pipelineItems,
  pipelines, requests, sendAttempts,
} from "./schema";
import { canSend, poolFor, type SendRequest } from "../gate";
import { generateDraft } from "../sourcing";
import { loadRequestContext } from "./loaders";
import type {
  Account, Brief, Channel, Db, ItemStatus, PipelineSource, RequestStatus, Role,
} from "../types";

/**
 * Writes on D1.
 *
 * D1 has no interactive transactions, so every function here follows one
 * shape: read what it needs, decide, then commit all of its writes with a
 * single `database.batch([...])`, which D1 applies atomically — all of them
 * or none.
 *
 * Where a decision must hold at the moment of the write (the last-admin rule,
 * "only move to pipeline_ready from in_sourcing"), the condition lives in the
 * write's own WHERE clause, so a concurrent change between read and write
 * makes the write a no-op rather than wrong.
 *
 * The one path that needs true read-then-write serialisation — a send that
 * debits a credit — is called only from the per-account AccountGate Durable
 * Object (worker/account-gate.ts), which processes one send per account at a
 * time.
 */

type Stmt = BatchItem<"sqlite">;

function audit(
  database: Database, actor: string, entity: string, action: string, detail = "",
): Stmt {
  return database.insert(auditEvents).values({ actor, entity, action, detail });
}

async function commit(database: Database, statements: Stmt[]): Promise<void> {
  if (statements.length === 0) return;
  await database.batch(statements as [Stmt, ...Stmt[]]);
}

const nowIso = () => new Date().toISOString();

export async function createRequest(
  input: {
    accountId: string; rawText: string; brief: Brief; slaHours: number;
    assignedAm?: string; useCase?: string; sectors?: string[];
  },
  database: Database = defaultDb,
): Promise<string> {
  const [account] = await database.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
  if (!account) throw new Error(`unknown account ${input.accountId}`);

  const id = crypto.randomUUID();
  await commit(database, [
    database.insert(requests).values({
      id,
      accountId: input.accountId,
      requesterName: account.displayName,
      requesterInitial: account.initial,
      rawText: input.rawText,
      status: "intent_review",
      goalType: input.brief.goalType,
      useCase: input.useCase,
      sectors: input.sectors ?? [],
      brief: input.brief,
      assignedAm: input.assignedAm,
      dueAt: new Date(Date.now() + input.slaHours * 3600_000).toISOString(),
    }),
    audit(database, account.displayName, id, "request.created", `عبر ${input.brief.extractedBy}`),
  ]);
  return id;
}

/**
 * Confirms the brief and writes the first draft pipeline.
 *
 * Phase 2 replaces the in-process `generateDraft` with RequestWorkflow (real
 * sourcing); until then the seeded draft keeps every screen walkable.
 */
export async function confirmBrief(
  requestId: string,
  summaryAr: string | undefined,
  database: Database = defaultDb,
): Promise<void> {
  const [request] = await database.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!request?.brief) return;
  // Already confirmed: a double-submitted form must not create a second v1.
  if (request.status !== "intent_review") return;

  const brief = request.brief as Brief;
  if (summaryAr) brief.summaryAr = summaryAr;

  const allPeople = (await database.select().from(people)).map(
    (p) => ({ ...p, linkedinUrl: p.linkedinUrl ?? undefined, email: p.email ?? undefined }),
  ) as Db["people"];
  const drafted = generateDraft(brief, allPeople);

  const pipelineId = crypto.randomUUID();
  const statements: Stmt[] = [
    database.update(requests).set({
      brief,
      status: "in_sourcing" as RequestStatus,
      confirmedAt: nowIso(),
    }).where(and(eq(requests.id, requestId), eq(requests.status, "intent_review"))),
    // The unique (request_id, version) index makes a racing second confirm
    // fail the whole batch instead of writing a duplicate v1.
    database.insert(pipelines).values({
      id: pipelineId, requestId, version: 1, source: "ai_generated", status: "draft", createdBy: "AI",
    }),
  ];
  // One statement per row: D1 caps bound parameters at 100 per statement, and
  // a pipeline row has 19 columns. The batch keeps them atomic together.
  for (const it of drafted) {
    statements.push(database.insert(pipelineItems).values({ ...it, pipelineId }));
  }
  statements.push(audit(database, request.requesterName, requestId, "brief.confirmed",
    `مسودة آلية بـ${drafted.length} أشخاص`));
  await commit(database, statements);
}

export async function setItemStatus(
  pipelineId: string, itemId: string, status: ItemStatus, actor: string,
  database: Database = defaultDb,
): Promise<void> {
  const [item] = await database.select().from(pipelineItems)
    .where(and(eq(pipelineItems.id, itemId), eq(pipelineItems.pipelineId, pipelineId))).limit(1);
  if (!item) return;

  // The evidence gate: a row with no sourced claim cannot be approved.
  if (status === "approved" && (item.evidence ?? []).length === 0) return;

  const next = item.status === status ? "proposed" : status;
  const [pipeline] = await database.select().from(pipelines).where(eq(pipelines.id, pipelineId)).limit(1);

  const statements: Stmt[] = [
    database.update(pipelineItems).set({ status: next }).where(eq(pipelineItems.id, itemId)),
  ];
  if (pipeline) statements.push(audit(database, actor, pipeline.requestId, `item.${next}`, item.personId));
  await commit(database, statements);
}

/**
 * Keeps only approved rows, publishes, and supersedes every other version —
 * so exactly one version is live per request and nothing was silently
 * force-approved on the way out. The partial unique index
 * pipelines_one_published_idx backs "exactly one" at the database level; the
 * supersede runs first in the batch so the publish never collides with it.
 */
export async function publishPipeline(
  pipelineId: string, actor: string, database: Database = defaultDb,
): Promise<string | null> {
  const [pipeline] = await database.select().from(pipelines).where(eq(pipelines.id, pipelineId)).limit(1);
  if (!pipeline) return null;

  const items = await database.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId));
  const approved = items.filter((i) => i.status === "approved");
  if (approved.length === 0) return null;

  const dropped = items.filter((i) => i.status !== "approved").map((i) => i.id);
  const statements: Stmt[] = [];
  if (dropped.length) statements.push(database.delete(pipelineItems).where(inArray(pipelineItems.id, dropped)));
  for (const [index, item] of approved.entries()) {
    statements.push(database.update(pipelineItems).set({ rank: index + 1 }).where(eq(pipelineItems.id, item.id)));
  }
  statements.push(
    database.update(pipelines).set({ status: "superseded" }).where(and(
      eq(pipelines.requestId, pipeline.requestId),
      ne(pipelines.id, pipelineId),
      ne(pipelines.status, "superseded"),
    )),
    database.update(pipelines)
      .set({ status: "published", publishedAt: nowIso() })
      .where(eq(pipelines.id, pipelineId)),
    database.update(requests).set({ status: "pipeline_ready" as RequestStatus })
      .where(and(eq(requests.id, pipeline.requestId), eq(requests.status, "in_sourcing"))),
    audit(database, actor, pipeline.requestId, "pipeline.published", `النسخة ${pipeline.version}`),
  );
  await commit(database, statements);
  return pipeline.requestId;
}

export interface AttachRow {
  latin: string; title: string; company: string;
  linkedinUrl?: string; email?: string;
}

const norm = (s?: string | null) => s?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

const SOURCE_LABEL: Record<PipelineSource, string> = {
  ai_generated: "مُولّدة آليًا", manual: "يدوي",
  imported_csv: "ملف مرفوع", pasted: "صفوف ملصقة", from_list: "قائمة جاهزة",
};

export async function attachPipeline(
  input: { requestId: string; source: PipelineSource; rows?: AttachRow[]; listId?: string; actor: string },
  database: Database = defaultDb,
): Promise<void> {
  const [request] = await database.select().from(requests).where(eq(requests.id, input.requestId)).limit(1);
  if (!request) return;

  const statements: Stmt[] = [];
  let personIds: string[] = [];
  const newPeople = new Map<string, { emailVerified: boolean }>();

  if (input.source === "from_list" && input.listId) {
    personIds = (await database.select().from(listMembers).where(eq(listMembers.listId, input.listId)))
      .map((m) => m.personId);
  } else {
    // Dedupe on LinkedIn URL, then email, then name+company — against stored
    // people and against earlier rows in this same upload.
    const kind = input.source === "imported_csv" ? "import" : "am";
    const existing = await database.select().from(people);
    const known = existing.map((p) => ({ id: p.id, latin: p.latin, company: p.company, linkedinUrl: p.linkedinUrl, email: p.email }));
    for (const row of input.rows ?? []) {
      const match = known.find(
        (p) =>
          (row.linkedinUrl && norm(p.linkedinUrl) === norm(row.linkedinUrl)) ||
          (row.email && p.email?.toLowerCase() === row.email.toLowerCase()) ||
          (p.latin.toLowerCase() === row.latin.toLowerCase() && p.company === row.company),
      );
      if (match) { personIds.push(match.id); continue; }

      const pid = crypto.randomUUID();
      statements.push(database.insert(people).values({
        id: pid,
        latin: row.latin,
        firstAr: row.latin.split(" ")[0] ?? row.latin,
        title: row.title, company: row.company, geo: "—",
        industries: [], seniority: "unknown",
        linkedinUrl: row.linkedinUrl, email: row.email,
        emailVerified: Boolean(row.email), openToIntros: false, source: kind,
      }));
      known.push({ id: pid, latin: row.latin, company: row.company, linkedinUrl: row.linkedinUrl ?? null, email: row.email ?? null });
      newPeople.set(pid, { emailVerified: Boolean(row.email) });
      personIds.push(pid);
    }
  }
  personIds = [...new Set(personIds)];
  if (personIds.length === 0) return;

  const versions = await database.select({ v: pipelines.version }).from(pipelines)
    .where(eq(pipelines.requestId, input.requestId));
  const version = Math.max(0, ...versions.map((r) => r.v)) + 1;

  const storedIds = personIds.filter((pid) => !newPeople.has(pid));
  const stored = storedIds.length
    ? await database.select({ id: people.id, emailVerified: people.emailVerified }).from(people)
        .where(inArray(people.id, storedIds))
    : [];
  const verified = (pid: string) =>
    newPeople.get(pid)?.emailVerified ?? stored.find((p) => p.id === pid)?.emailVerified ?? false;

  const pipelineId = crypto.randomUUID();
  statements.push(
    database.insert(pipelines).values({
      id: pipelineId, requestId: input.requestId, version, source: input.source,
      status: "draft", createdBy: input.actor,
    }),
    // One statement per row (D1's 100-parameter cap per statement).
    ...personIds.map((personId, index) => database.insert(pipelineItems).values({
        pipelineId, personId, rank: index + 1,
        fit: "medium" as const, thin: false,
        why: "أضافها مدير الحساب بعد مراجعة الطلب.",
        whyNow: "—", roleRelevance: "—", companyRelevance: "—", timing: "—",
        leadWith: "—", avoid: "—", opener: "",
        channel: (verified(personId) ? "email" : "linkedin") as Channel,
        status: "approved" as const,
        evidence: [{
          url: "", title: "بناها مدير الحساب يدويًا",
          source: SOURCE_LABEL[input.source], date: "اليوم", assertedBy: "am" as const,
        }],
        generatedBy: "am" as const,
      })),
    audit(database, input.actor, input.requestId, "pipeline.attached",
      `النسخة ${version} من ${SOURCE_LABEL[input.source]}`),
  );
  await commit(database, statements);
}

export interface SendOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * The money path. Call only from AccountGate (worker/account-gate.ts).
 *
 * Two concurrent sends could each read a balance of one and each debit it.
 * Postgres prevented that with SELECT … FOR UPDATE; on D1 the Durable Object
 * for the account runs one send at a time, so the second send reads the
 * first one's debit before the gate runs.
 *
 * Both verdicts are recorded — a refusal is as auditable as a send.
 */
export async function recordSend(
  input: SendRequest & { actor: string },
  database: Database = defaultDb,
): Promise<SendOutcome> {
  const context = await loadRequestContext(input.requestId, database);
  const verdict = canSend(context, input);

  const attempt = database.insert(sendAttempts).values({
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
    await commit(database, [
      attempt,
      audit(database, input.actor, input.requestId, "send.refused", verdict.failures.join(",")),
    ]);
    return { ok: false, reason: verdict.reason };
  }

  await commit(database, [
    attempt,
    database.insert(ledger).values({
      accountId: input.accountId, delta: -1, reason: "send", ref: input.personId,
    }),
    database.insert(outreach).values({
      requestId: input.requestId, personId: input.personId,
      channel: input.channel, status: "sent",
    }).onConflictDoUpdate({
      target: [outreach.requestId, outreach.personId],
      set: { status: "sent", channel: input.channel, updatedAt: nowIso() },
    }),
    database.update(requests).set({ status: "outreach" as RequestStatus })
      .where(and(eq(requests.id, input.requestId), eq(requests.status, "pipeline_ready"))),
    audit(database, input.actor, input.requestId, "send.allowed",
      `${poolFor(input.channel)}:${input.personId}`),
  ]);
  return { ok: true };
}

/** Development-only: stands in for verification and a credit purchase. */
export async function verifyAndGrant(
  accountId: string, amount: number, database: Database = defaultDb,
): Promise<void> {
  await commit(database, [
    database.update(accounts)
      .set({ state: "verified", verifiedAt: nowIso() })
      .where(eq(accounts.id, accountId)),
    // ref is fixed, so the ledger's unique index makes repeated grants a no-op
    // rather than free credits.
    database.insert(ledger)
      .values({ accountId, delta: amount, reason: "grant", ref: "dev-grant" })
      .onConflictDoNothing(),
    audit(database, "dev", accountId, "account.verified", `dev grant of ${amount} credits`),
  ]);
}

/** Why a verification was refused, so the caller can say something useful. */
export type VerifyResult =
  | { ok: true; granted: boolean }
  | { ok: false; reason: "unknown_account" };

/**
 * Verifies an account for sending and puts credits in its ledger.
 *
 * The production counterpart to verifyAndGrant, which stays dev-only. A
 * caller-supplied `ref` keeps a double-submitted form safe (the idempotency
 * index absorbs the repeat) while leaving a later top-up possible.
 *
 * `granted` reports which of the two happened, so the page can say "credits
 * added" rather than implying it when the index absorbed a repeat.
 */
export async function verifyAndCredit(
  input: { accountId: string; amount: number; ref: string; actor: string },
  database: Database = defaultDb,
): Promise<VerifyResult> {
  const [account] = await database
    .select({ id: accounts.id }).from(accounts)
    .where(eq(accounts.id, input.accountId)).limit(1);
  if (!account) return { ok: false, reason: "unknown_account" };

  const [, inserted] = await database.batch([
    database.update(accounts)
      .set({ state: "verified", verifiedAt: nowIso() })
      .where(eq(accounts.id, input.accountId)),
    database.insert(ledger)
      .values({ accountId: input.accountId, delta: input.amount, reason: "grant", ref: input.ref })
      .onConflictDoNothing()
      .returning({ id: ledger.id }),
  ]);
  const granted = inserted.length > 0;

  await commit(database, [
    audit(database, input.actor, input.accountId, "account.verified",
      granted
        ? `verified and granted ${input.amount} credits (${input.ref})`
        : `verified; grant ${input.ref} already applied`),
  ]);
  return { ok: true, granted };
}

/**
 * Credit standing by account, for the team page.
 *
 * `grants` counts grant rows rather than summing them, because it is what the
 * page turns into the next grant's ref. A count only ever goes up, so a
 * re-rendered page always produces a ref that has not been used, while a
 * double-submitted one repeats the ref it was rendered with and is absorbed.
 */
export type CreditStanding = { balance: number; grants: number };

export async function creditStanding(
  database: Database = defaultDb,
): Promise<Map<string, CreditStanding>> {
  const rows = await database
    .select({
      accountId: ledger.accountId,
      balance: sql<number>`coalesce(sum(${ledger.delta}), 0)`,
      grants: sql<number>`sum(case when ${ledger.reason} = 'grant' then 1 else 0 end)`,
    })
    .from(ledger)
    .groupBy(ledger.accountId);
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
 * Both refusals live here rather than on the page, because `grantRole` is a
 * server action — a POST endpoint anyone can invoke without loading a screen.
 *
 * The last-admin rule is enforced inside the UPDATE itself: demoting an admin
 * only happens if another admin still exists at the moment of the write. Two
 * concurrent demotions of the last two admins cannot both succeed, because
 * D1 serialises writes and the second one's subquery sees the first.
 */
export async function setAccountRole(
  input: { actorAccountId: string; targetAccountId: string; role: Role },
  database: Database = defaultDb,
): Promise<RoleChangeResult> {
  // An admin demoting themselves is almost always a misclick, and it is the
  // easiest way to trip the last-admin rule by accident.
  if (input.actorAccountId === input.targetAccountId) return { ok: false, reason: "self" };

  const [target] = await database
    .select().from(accounts).where(eq(accounts.id, input.targetAccountId)).limit(1);
  if (!target) return { ok: false, reason: "unknown_account" };
  if (target.role === input.role) return { ok: true };

  const [actor] = await database
    .select().from(accounts).where(eq(accounts.id, input.actorAccountId)).limit(1);

  const keepsAnAdmin: SQL = sql`(${accounts.role} != 'admin' or ${input.role} = 'admin' or exists (
    select 1 from ${accounts} as other where other.role = 'admin' and other.id != ${target.id}
  ))`;

  const [updated] = await database.batch([
    database.update(accounts).set({ role: input.role })
      .where(and(eq(accounts.id, target.id), keepsAnAdmin))
      .returning({ id: accounts.id }),
  ]);
  if (updated.length === 0) return { ok: false, reason: "last_admin" };

  await commit(database, [
    database.insert(auditEvents).values({
      actor: actor?.displayName ?? input.actorAccountId,
      entity: target.id,
      action: `role.${input.role}`,
      detail: `${target.email}: ${target.role} → ${input.role}`,
    }),
  ]);
  return { ok: true };
}

/** Every account, for the team screen. */
export async function listAccounts(database: Database = defaultDb): Promise<Account[]> {
  const rows = await database.select().from(accounts).orderBy(accounts.createdAt);
  // Nullable columns become optional fields (the Account shape uses undefined).
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? undefined])) as unknown as Account);
}

// ── Onboarding and activation ─────────────────────────────────

export interface OnboardingInput {
  accountId: string;
  name: string;
  company: string;
  companyWebsite?: string;
  jobTitle: string;
  useCase?: string;
  linkedinUrl?: string;
  locale: "ar" | "en";
}

/**
 * Completes /welcome. The display name is what account managers and the
 * people being introduced see, so it replaces the email-prefix placeholder
 * provisioning used (lib/session.ts).
 */
export async function completeOnboarding(input: OnboardingInput, database: Database = defaultDb): Promise<void> {
  const name = input.name.trim();
  await commit(database, [
    database.update(accounts).set({
      displayName: name,
      initial: (name[0] ?? "?").toUpperCase(),
      company: input.company.trim(),
      companyWebsite: input.companyWebsite?.trim() || null,
      jobTitle: input.jobTitle.trim(),
      useCase: input.useCase || null,
      linkedinUrl: input.linkedinUrl?.trim() || null,
      locale: input.locale,
      onboardedAt: nowIso(),
    }).where(eq(accounts.id, input.accountId)),
    audit(database, name, input.accountId, "account.onboarded", input.useCase ?? ""),
  ]);
}

/**
 * An observer asks to send. Idempotent: asking again refreshes the details
 * without resetting when they first asked (the queue is ordered by it).
 * Returns false for an account that is already verified — nothing to ask.
 */
export async function requestActivation(
  input: { accountId: string; linkedinUrl: string; companyWebsite: string; note?: string },
  database: Database = defaultDb,
): Promise<{ ok: boolean; first: boolean }> {
  const [account] = await database.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
  if (!account || account.state !== "observer") return { ok: false, first: false };
  const first = !account.activationRequestedAt;
  await commit(database, [
    database.update(accounts).set({
      linkedinUrl: input.linkedinUrl.trim(),
      companyWebsite: input.companyWebsite.trim(),
      activationNote: input.note?.trim() || null,
      activationRequestedAt: account.activationRequestedAt ?? nowIso(),
    }).where(eq(accounts.id, input.accountId)),
    audit(database, account.displayName, input.accountId, "account.activation_requested", input.companyWebsite),
  ]);
  return { ok: true, first };
}
