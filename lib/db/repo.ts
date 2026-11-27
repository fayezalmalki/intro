import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "./index";
import { db as defaultDb } from "./index";
import {
  accounts, auditEvents, creditOrders, leads, ledger, listMembers, outreach, people, pipelineItems,
  criteria, emailLog, outbound, pipelines, requests, searchCache, searchLog, sendAttempts, signups, suppressions,
} from "./schema";
import { canSend, poolFor, type SendRequest } from "../gate";
import { generateDraft } from "../sourcing";
import { loadRequestContext } from "./loaders";
import type {
  Account, Brief, Channel, Db, ItemStatus, PipelineItem, PipelineSource, RequestStatus, Role,
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

/**
 * Confirms the brief for live sourcing: the request moves to `in_sourcing`
 * with no pipeline yet, and RequestWorkflow (worker/request-workflow.ts)
 * writes v1 when it finishes. Returns whether sourcing should be (re)started:
 * true for a fresh confirm or a confirmed request still without a pipeline.
 */
export async function confirmBriefForSourcing(
  requestId: string,
  summaryAr: string | undefined,
  database: Database = defaultDb,
): Promise<boolean> {
  const [request] = await database.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!request?.brief) return false;
  if (request.status === "in_sourcing") {
    // Confirmed before, but the workflow may never have started (the start
    // failed after this commit). Starting again is safe: the instance id is
    // the request id. Once a pipeline exists there is nothing to start.
    const [pipeline] = await database.select({ id: pipelines.id }).from(pipelines)
      .where(eq(pipelines.requestId, requestId)).limit(1);
    return !pipeline;
  }
  if (request.status !== "intent_review") return false;

  const brief = request.brief as Brief;
  if (summaryAr) brief.summaryAr = summaryAr;
  await commit(database, [
    database.update(requests).set({
      brief,
      status: "in_sourcing" as RequestStatus,
      confirmedAt: nowIso(),
      workflowId: requestId,
    }).where(and(eq(requests.id, requestId), eq(requests.status, "intent_review"))),
    audit(database, request.requesterName, requestId, "brief.confirmed", "بدأ البحث عن الأشخاص"),
  ]);
  return true;
}

export interface SourcedPerson {
  key: string;
  name: string;
  title: string;
  company: string;
  companyDomain: string;
  industries: string[];
  seniority: string;
  linkedinUrl?: string;
  servedBy: string;
}

export type SourcedRow = Omit<PipelineItem, "id" | "personId"> & { candidateKey: string };

/**
 * Writes what RequestWorkflow sourced: the people (upserted by LinkedIn URL,
 * so a person found by two requests is one row), pipeline v1 and its rows,
 * and the request's sourcing spend — in one atomic batch.
 *
 * Idempotent: if v1 already exists (a workflow step retried after a commit
 * whose acknowledgement was lost) it returns that pipeline and writes nothing.
 */
export async function writeSourcedPipeline(
  input: {
    requestId: string;
    people: SourcedPerson[];
    rows: SourcedRow[];
    spentMicro: number;
    note?: string;
    createdBy: string;
  },
  database: Database = defaultDb,
): Promise<string | null> {
  const [request] = await database.select().from(requests).where(eq(requests.id, input.requestId)).limit(1);
  if (!request) return null;
  const [existing] = await database.select().from(pipelines)
    .where(and(eq(pipelines.requestId, input.requestId), eq(pipelines.version, 1))).limit(1);
  if (existing) return existing.id;

  const urls = input.people.map((p) => p.linkedinUrl).filter((u): u is string => !!u);
  const known = urls.length
    ? await database.select({ id: people.id, linkedinUrl: people.linkedinUrl }).from(people)
        .where(inArray(people.linkedinUrl, urls))
    : [];
  const idByUrl = new Map(known.map((k) => [k.linkedinUrl, k.id]));

  const statements: Stmt[] = [];
  const idByKey = new Map<string, string>();
  for (const p of input.people) {
    const fields = {
      latin: p.name,
      // No Arabic name from the provider; the opener greets by the first name as written.
      firstAr: p.name.split(/\s+/)[0] ?? p.name,
      title: p.title,
      company: p.company,
      companyDomain: p.companyDomain,
      geo: "السعودية",
      industries: p.industries,
      seniority: p.seniority,
      linkedinUrl: p.linkedinUrl,
      source: "provider" as const,
      servedBy: p.servedBy,
      updatedAt: nowIso(),
    };
    const knownId = p.linkedinUrl ? idByUrl.get(p.linkedinUrl) : undefined;
    if (knownId) {
      // Refresh what the provider says now; keep anything a person or AM set
      // (email, verification, open-to-intros) untouched.
      statements.push(database.update(people).set(fields).where(eq(people.id, knownId)));
      idByKey.set(p.key, knownId);
    } else {
      const id = crypto.randomUUID();
      statements.push(database.insert(people).values({ id, ...fields }));
      idByKey.set(p.key, id);
    }
  }

  const pipelineId = crypto.randomUUID();
  statements.push(database.insert(pipelines).values({
    id: pipelineId, requestId: input.requestId, version: 1, source: "ai_generated",
    status: "draft", createdBy: input.createdBy, note: input.note,
  }));
  for (const { candidateKey, ...row } of input.rows) {
    const personId = idByKey.get(candidateKey);
    if (!personId) continue;
    statements.push(database.insert(pipelineItems).values({ ...row, personId, pipelineId }));
  }
  statements.push(
    database.update(requests).set({ sourcingCostMicro: input.spentMicro }).where(eq(requests.id, input.requestId)),
    audit(database, input.createdBy, input.requestId, "pipeline.sourced",
      `${input.rows.length} أشخاص · ${(input.spentMicro / 1_000_000).toFixed(4)}$`),
  );
  await commit(database, statements);
  return pipelineId;
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
      company: input.company.trim() || null,
      companyWebsite: input.companyWebsite?.trim() || null,
      jobTitle: input.jobTitle.trim() || null,
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


// ── Search and leads ──────────────────────────────────────────

export async function logSearch(
  input: {
    accountId: string; kind: "companies" | "people" | "person" | "news" | "email"; query: Record<string, unknown>;
    results: number; costMicro: number; servedBy?: string;
    cacheKey?: string; billing?: "charged" | "refunded" | "free" | "internal"; cached?: boolean;
  },
  database: Database = defaultDb,
): Promise<void> {
  await database.insert(searchLog).values({ ...input, servedBy: input.servedBy ?? null, cacheKey: input.cacheKey ?? null, billing: input.billing ?? null, cached: input.cached ?? false });
}

/** A fresh cached answer for this question, or null. */
export async function getCached(key: string, database: Database = defaultDb): Promise<unknown[] | null> {
  const [row] = await database.select().from(searchCache)
    .where(and(eq(searchCache.key, key), sql`${searchCache.expiresAt} > ${nowIso()}`)).limit(1);
  if (!row) return null;
  await database.update(searchCache).set({ hits: sql`${searchCache.hits} + 1` }).where(eq(searchCache.key, key));
  return row.results;
}

export async function putCached(key: string, kind: string, results: unknown[], costMicro: number, ttlHours: number, database: Database = defaultDb) {
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  await database.insert(searchCache).values({ key, kind, results, count: results.length, costMicro, expiresAt, createdAt: nowIso(), hits: 0 })
    .onConflictDoUpdate({ target: searchCache.key, set: { results, count: results.length, costMicro, expiresAt, createdAt: nowIso(), hits: 0 } });
}

/** Did this account already pay for (or get) this exact question within the window? Then it's free. */
export async function ownRecentSearch(accountId: string, key: string, sinceIso: string, database: Database = defaultDb): Promise<boolean> {
  const [row] = await database.select({ id: searchLog.id }).from(searchLog)
    .where(and(eq(searchLog.accountId, accountId), eq(searchLog.cacheKey, key), sql`${searchLog.results} > 0`,
      sql`${searchLog.billing} in ('charged','free')`, sql`${searchLog.createdAt} >= ${sinceIso}`)).limit(1);
  return Boolean(row);
}

/** Searches run and micro-USD spent by an account since UTC midnight. */
export async function searchUsageToday(accountId: string, database: Database = defaultDb): Promise<{ count: number; costMicro: number }> {
  const since = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const [row] = await database
    .select({ count: sql<number>`count(*)`, costMicro: sql<number>`coalesce(sum(${searchLog.costMicro}), 0)` })
    .from(searchLog)
    .where(and(eq(searchLog.accountId, accountId), sql`${searchLog.createdAt} >= ${since}`));
  return { count: Number(row?.count ?? 0), costMicro: Number(row?.costMicro ?? 0) };
}

export interface LeadPerson {
  name: string;
  title: string;
  company: string;
  companyDomain?: string;
  linkedinUrl?: string;
  location?: string;
  servedBy?: string;
  industries?: string[];
  seniority: string;
}

/**
 * Saves a person from search as a lead: the person is upserted by LinkedIn
 * URL (one row however many accounts save them), the lead is unique per
 * account and person. Returns the lead id, new or existing.
 */
export async function saveLead(
  input: { accountId: string; person: LeadPerson; market?: string; source?: "search" | "request" },
  database: Database = defaultDb,
): Promise<string> {
  const p = input.person;
  let personId: string | undefined;
  if (p.linkedinUrl) {
    const [known] = await database.select({ id: people.id }).from(people).where(eq(people.linkedinUrl, p.linkedinUrl)).limit(1);
    personId = known?.id;
  }
  const fields = {
    latin: p.name, firstAr: p.name.split(/\s+/)[0] ?? p.name, title: p.title, company: p.company,
    companyDomain: p.companyDomain ?? null, geo: p.location ?? "", industries: p.industries ?? [],
    seniority: p.seniority, linkedinUrl: p.linkedinUrl ?? null, source: "provider" as const,
    servedBy: p.servedBy ?? null, updatedAt: nowIso(),
  };
  const statements: Stmt[] = [];
  if (personId) {
    statements.push(database.update(people).set(fields).where(eq(people.id, personId)));
  } else {
    personId = crypto.randomUUID();
    statements.push(database.insert(people).values({ id: personId, ...fields }));
  }
  statements.push(
    database.insert(leads)
      .values({ accountId: input.accountId, personId, source: input.source ?? "search", market: input.market ?? null })
      .onConflictDoNothing(),
  );
  await commit(database, statements);
  const [lead] = await database.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.accountId, input.accountId), eq(leads.personId, personId))).limit(1);
  return lead!.id;
}

export type LeadRow = typeof leads.$inferSelect & { person: typeof people.$inferSelect };

export async function listLeads(accountId: string, database: Database = defaultDb): Promise<LeadRow[]> {
  const rows = await database.select().from(leads).innerJoin(people, eq(leads.personId, people.id))
    .where(eq(leads.accountId, accountId)).orderBy(sql`${leads.createdAt} desc`);
  return rows.map((r) => ({ ...r.leads, person: r.people }));
}

export async function getLead(accountId: string, leadId: string, database: Database = defaultDb): Promise<LeadRow | null> {
  const [r] = await database.select().from(leads).innerJoin(people, eq(leads.personId, people.id))
    .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId))).limit(1);
  return r ? { ...r.leads, person: r.people } : null;
}

export async function saveLeadSignals(leadId: string, signals: NonNullable<typeof leads.$inferSelect["signals"]>, database: Database = defaultDb) {
  await database.update(leads).set({ signals }).where(eq(leads.id, leadId));
}

/**
 * Reserves the credit for revealing a lead's email. Runs inside the
 * AccountGate Durable Object (one call per account at a time), so two reveals
 * can never both spend the last credit. Revealing the same person again is
 * free: the ledger ref is the person, and ledger_idempotency_idx holds it.
 */
export async function reserveReveal(
  input: { accountId: string; personId: string },
  database: Database = defaultDb,
): Promise<{ ok: true; charged: boolean } | { ok: false; reason: "insufficient_credits" }> {
  return reserveCredit({ accountId: input.accountId, reason: "reveal", ref: `reveal:${input.personId}` }, database);
}

/**
 * Takes one credit for `reason`/`ref`, or refuses at zero. Idempotent on the
 * ref (ledger_idempotency_idx): asking again for the same ref is free. Called
 * only inside the AccountGate Durable Object, so two calls from one account
 * never race for the last credit.
 */
export async function reserveCredit(
  input: { accountId: string; reason: "reveal" | "search" | "request"; ref: string; amount?: number },
  database: Database = defaultDb,
): Promise<{ ok: true; charged: boolean } | { ok: false; reason: "insufficient_credits" }> {
  const [already] = await database.select({ id: ledger.id }).from(ledger)
    .where(and(eq(ledger.accountId, input.accountId), eq(ledger.reason, input.reason), eq(ledger.ref, input.ref))).limit(1);
  if (already) return { ok: true, charged: false };
  const amount = input.amount ?? 1;
  if ((await creditBalance(input.accountId, database)) < amount) return { ok: false, reason: "insufficient_credits" };
  await database.insert(ledger).values({ accountId: input.accountId, delta: -amount, reason: input.reason, ref: input.ref }).onConflictDoNothing();
  return { ok: true, charged: true };
}

/** Gives back a search's credit (nothing found, or the provider failed). */
export async function refundSearch(accountId: string, ref: string, database: Database = defaultDb): Promise<void> {
  await database.insert(ledger).values({ accountId, delta: 1, reason: "refund_search", ref }).onConflictDoNothing();
}

/** Records what the reveal found, and refunds the credit when nothing usable was. */
export async function recordReveal(
  input: { accountId: string; leadId: string; personId: string; email: string | null; status: "valid" | "risky" | "invalid" | "not_found" },
  database: Database = defaultDb,
): Promise<void> {
  const usable = input.email && input.status !== "invalid";
  const statements: Stmt[] = [
    database.update(leads).set({ email: usable ? input.email : null, emailStatus: input.status, revealedAt: nowIso() })
      .where(and(eq(leads.id, input.leadId), eq(leads.accountId, input.accountId))),
    audit(database, input.accountId, input.leadId, "lead.revealed", input.status),
  ];
  if (usable) {
    statements.push(database.update(people).set({ email: input.email, emailVerified: input.status === "valid" }).where(eq(people.id, input.personId)));
  } else {
    statements.push(database.insert(ledger)
      .values({ accountId: input.accountId, delta: 1, reason: "refund_reveal", ref: `reveal:${input.personId}` })
      .onConflictDoNothing());
  }
  await commit(database, statements);
}

/** Starter credits on finishing onboarding — enough for a real first session of searches and reveals. */
export const WELCOME_CREDITS = 20;
export async function grantWelcomeCredits(accountId: string, database: Database = defaultDb): Promise<void> {
  await database.insert(ledger)
    .values({ accountId, delta: WELCOME_CREDITS, reason: "grant", ref: "welcome" })
    .onConflictDoNothing();
}

export async function creditBalance(accountId: string, database: Database = defaultDb): Promise<number> {
  const [bal] = await database.select({ balance: sql<number>`coalesce(sum(${ledger.delta}), 0)` })
    .from(ledger).where(eq(ledger.accountId, accountId));
  return Number(bal?.balance ?? 0);
}

/**
 * Self-serve accounts don't wait for an account manager: every row backed by
 * a source is approved and the pipeline is published straight away. Rows
 * without evidence stay out, as they would in review. Managed accounts keep
 * the review step (the caller decides).
 */
export async function autoPublish(pipelineId: string, actor: string, database: Database = defaultDb): Promise<string | null> {
  const items = await database.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, pipelineId));
  const backed = items.filter((i) => (i.evidence ?? []).length > 0).map((i) => i.id);
  if (backed.length === 0) return null;
  await database.update(pipelineItems).set({ status: "approved" }).where(inArray(pipelineItems.id, backed));
  return publishPipeline(pipelineId, actor, database);
}

export async function autoPublishLatestDraft(requestId: string, actor: string, database: Database = defaultDb): Promise<string | null> {
  const [draft] = await database.select({ id: pipelines.id }).from(pipelines)
    .where(and(eq(pipelines.requestId, requestId), eq(pipelines.status, "draft")))
    .orderBy(sql`${pipelines.version} desc`).limit(1);
  return draft ? autoPublish(draft.id, actor, database) : null;
}

/** Where an account is in its first-run journey, for the home checklist. */
export async function journeyStats(accountId: string, database: Database = defaultDb) {
  const [s] = await database.select({ n: sql<number>`count(*)` }).from(searchLog).where(eq(searchLog.accountId, accountId));
  const [l] = await database.select({
    n: sql<number>`count(*)`,
    revealed: sql<number>`coalesce(sum(case when ${leads.email} is not null then 1 else 0 end), 0)`,
  }).from(leads).where(eq(leads.accountId, accountId));
  const [r] = await database.select({ n: sql<number>`count(*)` }).from(requests).where(eq(requests.accountId, accountId));
  return { searches: Number(s?.n ?? 0), leads: Number(l?.n ?? 0), revealed: Number(l?.revealed ?? 0), requests: Number(r?.n ?? 0) };
}


// ── Billing ───────────────────────────────────────────────────

export type CreditOrder = typeof creditOrders.$inferSelect;

export async function createOrder(input: { accountId: string; package: string; credits: number; amountHalalas: number }, database: Database = defaultDb): Promise<string> {
  const id = crypto.randomUUID();
  await database.insert(creditOrders).values({ id, ...input });
  return id;
}

export async function attachInvoice(orderId: string, invoiceId: string, database: Database = defaultDb): Promise<void> {
  await database.update(creditOrders).set({ invoiceId, status: "initiated" }).where(eq(creditOrders.id, orderId));
}

export async function getOrder(id: string, database: Database = defaultDb): Promise<CreditOrder | null> {
  const [o] = await database.select().from(creditOrders).where(eq(creditOrders.id, id)).limit(1);
  return o ?? null;
}

export async function orderByInvoice(invoiceId: string, database: Database = defaultDb): Promise<CreditOrder | null> {
  const [o] = await database.select().from(creditOrders).where(eq(creditOrders.invoiceId, invoiceId)).limit(1);
  return o ?? null;
}

/**
 * Applies what Moyasar's API says about an order's invoice. Credits are
 * granted once: the ledger row's ref is the invoice id, and the idempotency
 * index absorbs a second settle (return page and callback can both arrive).
 */
export async function settleOrder(
  order: CreditOrder,
  invoice: { id: string; status: string; amount: number; currency: string },
  database: Database = defaultDb,
): Promise<"paid" | "pending" | "failed"> {
  if (invoice.id !== order.invoiceId) return "failed";
  if (invoice.status === "paid") {
    // Never grant for a different amount than the order was created for.
    if (invoice.amount !== order.amountHalalas || invoice.currency !== "SAR") return "failed";
    await commit(database, [
      database.insert(ledger).values({ accountId: order.accountId, delta: order.credits, reason: "purchase", ref: `moyasar:${invoice.id}` }).onConflictDoNothing(),
      database.update(creditOrders).set({ status: "paid", paidAt: order.paidAt ?? nowIso() }).where(eq(creditOrders.id, order.id)),
      audit(database, order.accountId, order.id, "credits.purchased", `${order.credits} credits · ${order.amountHalalas / 100} SAR`),
    ]);
    return "paid";
  }
  const terminal = ["failed", "expired", "canceled", "voided"].includes(invoice.status);
  if (terminal) {
    await database.update(creditOrders).set({ status: invoice.status === "voided" ? "canceled" : (invoice.status as "failed" | "expired" | "canceled") }).where(eq(creditOrders.id, order.id));
    return "failed";
  }
  return "pending";
}

export async function listOrders(accountId: string, database: Database = defaultDb): Promise<CreditOrder[]> {
  return database.select().from(creditOrders).where(eq(creditOrders.accountId, accountId)).orderBy(sql`${creditOrders.createdAt} desc`).limit(20);
}

/** Recent credit movements, for the billing page. */
export async function recentLedger(accountId: string, database: Database = defaultDb) {
  return database.select().from(ledger).where(eq(ledger.accountId, accountId)).orderBy(sql`${ledger.at} desc`).limit(30);
}


/** Credits a request costs: it runs a whole sourcing pass (up to the $0.25 budget). */
export const REQUEST_CREDITS = 5;

export async function refundRequest(accountId: string, requestId: string, database: Database = defaultDb): Promise<void> {
  await database.insert(ledger).values({ accountId, delta: REQUEST_CREDITS, reason: "refund_request", ref: `request:${requestId}` }).onConflictDoNothing();
}

/** This month's credit use for one account, by what it was spent on. */
export async function usageThisMonth(accountId: string, database: Database = defaultDb) {
  const since = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const rows = await database.select({ reason: ledger.reason, n: sql<number>`count(*)`, delta: sql<number>`sum(${ledger.delta})` })
    .from(ledger).where(and(eq(ledger.accountId, accountId), sql`${ledger.at} >= ${since}`)).groupBy(ledger.reason);
  const by = Object.fromEntries(rows.map((r) => [r.reason, { n: Number(r.n), delta: Number(r.delta) }]));
  const [free] = await database.select({ n: sql<number>`count(*)` }).from(searchLog)
    .where(and(eq(searchLog.accountId, accountId), eq(searchLog.billing, "free"), sql`${searchLog.createdAt} >= ${since}`));
  const net = (spend: string, refund: string) => Math.max(0, -(by[spend]?.delta ?? 0) - (by[refund]?.delta ?? 0));
  return {
    searches: net("search", "refund_search"), searchesRefunded: by.refund_search?.n ?? 0, searchesFree: Number(free?.n ?? 0),
    reveals: net("reveal", "refund_reveal"), requests: net("request", "refund_request"), sends: -(by.send?.delta ?? 0),
    added: Object.entries(by).filter(([r]) => r === "purchase" || r === "grant").reduce((n, [, v]) => n + v.delta, 0),
  };
}

/** Platform economics for admins, over the last 30 days. */
export async function platformEconomics(database: Database = defaultDb) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [s] = await database.select({
    n: sql<number>`count(*)`, cost: sql<number>`coalesce(sum(${searchLog.costMicro}), 0)`,
    cached: sql<number>`coalesce(sum(case when ${searchLog.cached} then 1 else 0 end), 0)`,
    empty: sql<number>`coalesce(sum(case when ${searchLog.results} = 0 then 1 else 0 end), 0)`,
  }).from(searchLog).where(sql`${searchLog.createdAt} >= ${since}`);
  const [r] = await database.select({ cost: sql<number>`coalesce(sum(${requests.sourcingCostMicro}), 0)` }).from(requests).where(sql`${requests.createdAt} >= ${since}`);
  const [o] = await database.select({ halalas: sql<number>`coalesce(sum(${creditOrders.amountHalalas}), 0)`, credits: sql<number>`coalesce(sum(${creditOrders.credits}), 0)`, n: sql<number>`count(*)` })
    .from(creditOrders).where(and(eq(creditOrders.status, "paid"), sql`${creditOrders.createdAt} >= ${since}`));
  const [used] = await database.select({ n: sql<number>`coalesce(-sum(${ledger.delta}), 0)` }).from(ledger)
    .where(and(sql`${ledger.at} >= ${since}`, sql`${ledger.reason} in ('search','refund_search','reveal','refund_reveal','request','refund_request','send','refund_bounce','refund_suppressed')`));
  const [cache] = await database.select({ rows: sql<number>`count(*)`, hits: sql<number>`coalesce(sum(${searchCache.hits}), 0)` }).from(searchCache);
  return {
    searches: Number(s?.n ?? 0), cachedSearches: Number(s?.cached ?? 0), emptySearches: Number(s?.empty ?? 0),
    tregUsd: (Number(s?.cost ?? 0) + Number(r?.cost ?? 0)) / 1e6,
    revenueSar: Number(o?.halalas ?? 0) / 100, ordersPaid: Number(o?.n ?? 0), creditsSold: Number(o?.credits ?? 0), creditsUsed: Number(used?.n ?? 0),
    cacheEntries: Number(cache?.rows ?? 0), cacheHits: Number(cache?.hits ?? 0),
  };
}

// ── Sign-ups ──────────────────────────────────────────────────

/**
 * A sign-in code was requested. One row per address per hour at most, so a
 * visitor pressing "resend" does not fill the list with duplicates.
 */
export async function recordSignup(
  input: { email: string; pending?: string; lang?: string; referrer?: string },
  database: Database = defaultDb,
): Promise<void> {
  const email = input.email.trim().toLowerCase().slice(0, 254);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [recent] = await database.select({ id: signups.id, pending: signups.pending }).from(signups)
    .where(and(eq(signups.email, email), sql`${signups.createdAt} > ${hourAgo}`)).limit(1);
  if (recent) {
    if (input.pending && !recent.pending) await database.update(signups).set({ pending: input.pending }).where(eq(signups.id, recent.id));
    return;
  }
  await database.insert(signups).values({
    email,
    pending: input.pending?.slice(0, 1000),
    lang: input.lang === "en" ? "en" : input.lang === "ar" ? "ar" : undefined,
    referrer: input.referrer?.slice(0, 500),
  });
}

/** First sign-in: the address proved it is theirs. */
export async function linkSignup(email: string, accountId: string, database: Database = defaultDb): Promise<void> {
  await database.update(signups).set({ accountId, verifiedAt: nowIso() })
    .where(and(eq(signups.email, email.toLowerCase()), sql`${signups.accountId} IS NULL`));
}

export async function markSignupOnboarded(accountId: string, database: Database = defaultDb): Promise<void> {
  await database.update(signups).set({ onboardedAt: nowIso() })
    .where(and(eq(signups.accountId, accountId), sql`${signups.onboardedAt} IS NULL`));
}

export type SignupRow = typeof signups.$inferSelect;

export async function listSignups(limit = 200, database: Database = defaultDb): Promise<SignupRow[]> {
  return database.select().from(signups).orderBy(sql`${signups.createdAt} DESC`).limit(limit);
}

// ── Onboarding reads ──────────────────────────────────────────

/** How many profile/website reads this account has used (they cost us, not them). */
export async function profileReadsUsed(accountId: string, database: Database = defaultDb): Promise<number> {
  const [r] = await database.select({ n: sql<number>`count(*)` }).from(auditEvents)
    .where(and(eq(auditEvents.entity, `account:${accountId}`), eq(auditEvents.action, "profile_read")));
  return Number(r?.n ?? 0);
}

export async function recordProfileRead(accountId: string, detail: string, database: Database = defaultDb): Promise<void> {
  await audit(database, accountId, `account:${accountId}`, "profile_read", detail.slice(0, 300));
}

// ── Saved criteria ────────────────────────────────────────────

export type Criteria = typeof criteria.$inferSelect;
const MAX_CRITERIA = 30;

export async function listCriteria(accountId: string, database: Database = defaultDb): Promise<Criteria[]> {
  return database.select().from(criteria).where(eq(criteria.accountId, accountId)).orderBy(sql`${criteria.createdAt} DESC`);
}

/** Saves a criteria set; null when the account already keeps the maximum. */
export async function saveCriteria(
  input: { accountId: string; name: string; market: string; sector?: string; keywords?: string; role?: string; signal?: string },
  database: Database = defaultDb,
): Promise<string | null> {
  const [n] = await database.select({ n: sql<number>`count(*)` }).from(criteria).where(eq(criteria.accountId, input.accountId));
  if (Number(n?.n ?? 0) >= MAX_CRITERIA) return null;
  const id = crypto.randomUUID();
  await database.insert(criteria).values({
    id, accountId: input.accountId, name: input.name.slice(0, 80), market: input.market,
    sector: input.sector || null, keywords: input.keywords?.slice(0, 200) || null, role: input.role?.slice(0, 60) || null, signal: input.signal?.slice(0, 40) || null,
  });
  return id;
}

export async function deleteCriteria(accountId: string, id: string, database: Database = defaultDb): Promise<void> {
  await database.delete(criteria).where(and(eq(criteria.id, id), eq(criteria.accountId, accountId)));
}

// ── The CRM: stages and follow-ups ────────────────────────────

export type LeadStage = "saved" | "contacted" | "replied" | "meeting" | "closed";
export type LeadAction = "sent" | "replied" | "meeting" | "closed" | "reopen";

/**
 * Moves a lead along. "sent" is the person telling us they sent the next
 * message (the first, or a follow-up) from their own email: it schedules the
 * next follow-up, until the sequence ends. A reply, a meeting or closing stops
 * follow-ups. Returns the updated lead, or null if it isn't theirs.
 */
export async function updateLeadStage(
  accountId: string, leadId: string, action: LeadAction, database: Database = defaultDb,
): Promise<LeadRow | null> {
  const lead = await getLead(accountId, leadId, database);
  if (!lead) return null;
  const now = new Date();
  const iso = now.toISOString();
  const { nextFollowUp } = await import("../followup");
  let set: Partial<typeof leads.$inferInsert>;
  if (action === "sent") {
    const first = lead.stage === "saved" || lead.stage === "closed" || !lead.contactedAt;
    const followUps = first ? 0 : Math.min(lead.followUps + 1, 2);
    set = {
      stage: "contacted", contactedAt: first ? iso : lead.contactedAt, lastTouchAt: iso,
      followUps, followUpAt: nextFollowUp(first ? 0 : followUps, now), remindedAt: null,
    };
  } else if (action === "reopen") {
    set = { stage: lead.contactedAt ? "contacted" : "saved", followUpAt: null };
  } else {
    set = { stage: action, followUpAt: null, lastTouchAt: iso };
  }
  await commit(database, [
    database.update(leads).set(set).where(and(eq(leads.id, leadId), eq(leads.accountId, accountId))),
    audit(database, accountId, `lead:${leadId}`, `lead.${action}`),
  ]);
  return getLead(accountId, leadId, database);
}

/** This account's leads whose follow-up is due by `now`. */
export async function dueFollowUps(accountId: string, now = new Date(), database: Database = defaultDb): Promise<LeadRow[]> {
  const rows = await database.select().from(leads).innerJoin(people, eq(leads.personId, people.id))
    .where(and(eq(leads.accountId, accountId), eq(leads.stage, "contacted"), sql`${leads.followUpAt} IS NOT NULL AND ${leads.followUpAt} <= ${now.toISOString()}`))
    .orderBy(sql`${leads.followUpAt} ASC`);
  return rows.map((r) => ({ ...r.leads, person: r.people }));
}

/** Every account with follow-ups due and not yet reminded about, for the daily email. */
export async function followUpReminders(now = new Date(), database: Database = defaultDb) {
  const rows = await database.select({ lead: leads, person: people, account: accounts }).from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .innerJoin(accounts, eq(leads.accountId, accounts.id))
    .where(and(eq(leads.stage, "contacted"), sql`${leads.followUpAt} IS NOT NULL AND ${leads.followUpAt} <= ${now.toISOString()}`,
      sql`(${leads.remindedAt} IS NULL OR ${leads.remindedAt} < ${leads.followUpAt})`))
    .limit(500);
  const byAccount = new Map<string, { account: typeof accounts.$inferSelect; leads: { id: string; name: string; company: string; step: number }[] }>();
  for (const r of rows) {
    const entry = byAccount.get(r.account.id) ?? { account: r.account, leads: [] };
    entry.leads.push({ id: r.lead.id, name: r.person.latin, company: r.person.company, step: r.lead.followUps + 1 });
    byAccount.set(r.account.id, entry);
  }
  return [...byAccount.values()];
}

export async function markReminded(leadIds: string[], at = new Date(), database: Database = defaultDb): Promise<void> {
  if (!leadIds.length) return;
  await database.update(leads).set({ remindedAt: at.toISOString() }).where(inArray(leads.id, leadIds));
}

/** The lead for a person already in the graph (a request result), created if needed. */
export async function leadForPerson(accountId: string, personId: string, market: string, database: Database = defaultDb): Promise<string> {
  // A verified address already in the graph comes with the lead: no reveal needed.
  const [p] = await database.select({ email: people.email, verified: people.emailVerified }).from(people).where(eq(people.id, personId)).limit(1);
  const email = p?.verified && p.email ? p.email : null;
  await database.insert(leads).values({ accountId, personId, source: "request", market, email, emailStatus: email ? "valid" : null, revealedAt: email ? nowIso() : null }).onConflictDoNothing();
  const [row] = await database.select({ id: leads.id }).from(leads).where(and(eq(leads.accountId, accountId), eq(leads.personId, personId))).limit(1);
  return row.id;
}

// ── Email log ─────────────────────────────────────────────────

export async function logEmail(
  input: { kind: (typeof emailLog.$inferInsert)["kind"]; to: string; transport: "smtp" | "binding" | "log"; status: "sent" | "failed"; error?: string },
  database: Database = defaultDb,
): Promise<void> {
  await database.insert(emailLog).values({ ...input, to: input.to.toLowerCase().slice(0, 254), error: input.error ?? null });
}

// ── Monitoring ────────────────────────────────────────────────

/** Everything the monitoring page shows, in one round of queries. */
export async function monitoring(database: Database = defaultDb) {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const d1 = iso(now - 86_400_000), d7 = iso(now - 7 * 86_400_000), d14 = iso(now - 14 * 86_400_000);
  const one = async <T extends Record<string, unknown>>(q: SQL) => ((await database.all(q)) as T[])[0] ?? ({} as T);
  const all = async <T,>(q: SQL) => (await database.all(q)) as T[];
  const n = (v: unknown) => Number(v ?? 0);

  const [users, funnel7, funnelAll, activity, emails7, emailFail24, recentEmails, newByDay, topAccounts, money] = await Promise.all([
    one<{ total: number; onboarded: number; active7: number }>(sql`select
      (select count(*) from ${accounts}) total,
      (select count(*) from ${accounts} where ${accounts.onboardedAt} is not null) onboarded,
      (select count(distinct account_id) from (
        select ${searchLog.accountId} account_id from ${searchLog} where ${searchLog.createdAt} >= ${d7}
        union select ${leads.accountId} from ${leads} where coalesce(${leads.lastTouchAt}, ${leads.createdAt}) >= ${d7}
        union select ${requests.accountId} from ${requests} where ${requests.createdAt} >= ${d7})) active7`),
    one<{ codes: number; verified: number; onboarded: number }>(sql`select count(*) codes,
      sum(case when ${signups.verifiedAt} is not null then 1 else 0 end) verified,
      sum(case when ${signups.onboardedAt} is not null then 1 else 0 end) onboarded
      from ${signups} where ${signups.createdAt} >= ${d7}`),
    one<{ codes: number; verified: number; onboarded: number }>(sql`select count(*) codes,
      sum(case when ${signups.verifiedAt} is not null then 1 else 0 end) verified,
      sum(case when ${signups.onboardedAt} is not null then 1 else 0 end) onboarded from ${signups}`),
    one<Record<string, number>>(sql`select
      (select count(*) from ${searchLog} where ${searchLog.createdAt} >= ${d7} and ${searchLog.kind} != 'email') searches,
      (select count(*) from ${ledger} where ${ledger.reason} = 'reveal' and ${ledger.at} >= ${d7}) reveals,
      (select count(*) from ${leads} where ${leads.createdAt} >= ${d7}) saved,
      (select count(*) from ${leads} where ${leads.contactedAt} >= ${d7}) contacted,
      (select count(*) from ${leads} where ${leads.stage} = 'replied') replied,
      (select count(*) from ${leads} where ${leads.stage} = 'meeting') meetings,
      (select count(*) from ${leads} where ${leads.stage} = 'contacted' and ${leads.followUpAt} <= ${iso(now)}) due,
      (select count(*) from ${requests} where ${requests.createdAt} >= ${d7}) requests`),
    all<{ kind: string; status: string; transport: string; n: number }>(sql`select ${emailLog.kind} kind, ${emailLog.status} status, ${emailLog.transport} transport, count(*) n
      from ${emailLog} where ${emailLog.createdAt} >= ${d7} group by 1, 2, 3 order by n desc`),
    one<{ n: number }>(sql`select count(*) n from ${emailLog} where ${emailLog.status} = 'failed' and ${emailLog.createdAt} >= ${d1}`),
    database.select().from(emailLog).orderBy(sql`${emailLog.createdAt} desc`).limit(25),
    all<{ day: string; n: number }>(sql`select substr(${accounts.createdAt}, 1, 10) day, count(*) n from ${accounts} where ${accounts.createdAt} >= ${d14} group by 1 order by 1`),
    all<{ email: string; searches: number; leads: number }>(sql`select ${accounts.email} email,
      (select count(*) from ${searchLog} where ${searchLog.accountId} = ${accounts.id} and ${searchLog.createdAt} >= ${d7}) searches,
      (select count(*) from ${leads} where ${leads.accountId} = ${accounts.id}) leads
      from ${accounts} order by searches desc, leads desc limit 8`),
    one<{ orders: number; halalas: number }>(sql`select count(*) orders, coalesce(sum(${creditOrders.amountHalalas}), 0) halalas from ${creditOrders} where ${creditOrders.status} = 'paid'`),
  ]);
  return {
    users: { total: n(users.total), onboarded: n(users.onboarded), active7: n(users.active7) },
    funnel7: { codes: n(funnel7.codes), verified: n(funnel7.verified), onboarded: n(funnel7.onboarded) },
    funnelAll: { codes: n(funnelAll.codes), verified: n(funnelAll.verified), onboarded: n(funnelAll.onboarded) },
    activity: Object.fromEntries(Object.entries(activity).map(([k, v]) => [k, n(v)])) as Record<string, number>,
    emails7: emails7.map((r) => ({ ...r, n: n(r.n) })),
    emailFail24: n(emailFail24.n),
    recentEmails,
    newByDay: newByDay.map((r) => ({ day: r.day, n: n(r.n) })),
    topAccounts: topAccounts.map((r) => ({ email: r.email, searches: n(r.searches), leads: n(r.leads) })),
    money: { orders: n(money.orders), sar: n(money.halalas) / 100 },
  };
}

/** Addresses the team already invited back from the sign-ups page. */
export async function invitedSignups(database: Database = defaultDb): Promise<Set<string>> {
  const rows = await database.select({ entity: auditEvents.entity }).from(auditEvents).where(eq(auditEvents.action, "signup.invited"));
  return new Set(rows.map((r) => r.entity.replace(/^signup:/, "")));
}

export async function recordInvite(actor: string, email: string, database: Database = defaultDb): Promise<void> {
  await audit(database, actor, `signup:${email.toLowerCase()}`, "signup.invited");
}

/** True when this address asked for a code and never signed in. */
export async function signupNeverVerified(email: string, database: Database = defaultDb): Promise<boolean> {
  const rows = await database.select({ verifiedAt: signups.verifiedAt }).from(signups).where(eq(signups.email, email.toLowerCase()));
  return rows.length > 0 && rows.every((r) => !r.verifiedAt);
}

// ── Sending through intro ─────────────────────────────────────

/** Everything the send checks need for one lead (lib/outbound.ts). */
export async function outboundContext(accountId: string, leadId: string, configured: boolean, now = new Date(), database: Database = defaultDb) {
  const { hashEmail } = await import("../suppression");
  const { RECIPIENT_COOLDOWN_DAYS } = await import("../outbound");
  const lead = await getLead(accountId, leadId, database);
  if (!lead) return null;
  const [account] = await database.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const toHash = lead.email ? hashEmail(lead.email) : "";
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const cooldown = new Date(now.getTime() - RECIPIENT_COOLDOWN_DAYS * 86_400_000).toISOString();
  const [[supp], [others], [mineToday], [allToday], firsts, [sentHere]] = await Promise.all([
    toHash ? database.select({ h: suppressions.emailHash }).from(suppressions).where(eq(suppressions.emailHash, toHash)).limit(1) : Promise.resolve([]),
    toHash ? database.select({ n: sql<number>`count(*)` }).from(outbound).where(and(eq(outbound.toHash, toHash), eq(outbound.status, "sent"), sql`${outbound.accountId} != ${accountId}`, sql`${outbound.createdAt} >= ${cooldown}`)) : Promise.resolve([{ n: 0 }]),
    database.select({ n: sql<number>`count(*)` }).from(outbound).where(and(eq(outbound.accountId, accountId), eq(outbound.status, "sent"), sql`${outbound.createdAt} >= ${dayStart.toISOString()}`)),
    database.select({ n: sql<number>`count(*)` }).from(outbound).where(and(eq(outbound.status, "sent"), sql`${outbound.createdAt} >= ${dayStart.toISOString()}`)),
    database.select({ body: outbound.body }).from(outbound).where(and(eq(outbound.accountId, accountId), eq(outbound.status, "sent"), eq(outbound.step, 0))).orderBy(sql`${outbound.createdAt} desc`).limit(30),
    database.select({ n: sql<number>`count(*)` }).from(outbound).where(and(eq(outbound.leadId, leadId), eq(outbound.status, "sent"))),
  ]);
  // The step is how far this lead's sequence has gone, by either route.
  const step = lead.stage === "saved" || !lead.contactedAt ? 0 : Math.max(lead.followUps + 1, Number(sentHere?.n ?? 0));
  return {
    lead, account, toHash,
    ctx: {
      eligible: account?.state === "verified",
      paused: Boolean(account?.frozenAt),
      configured,
      emailStatus: lead.emailStatus,
      suppressed: Boolean(supp),
      contactedByOthers: Number(others?.n ?? 0) > 0,
      step,
      sentToday: Number(mineToday?.n ?? 0),
      dailyCap: account?.dailyCap ?? 10,
      platformSentToday: Number(allToday?.n ?? 0),
      recentFirstBodies: firsts.map((r) => r.body),
    },
  };
}

/** Bounce threshold for pausing an account: this many failures in 7 days, and at least this share of sends. */
const PAUSE_FAILURES = 3;
const PAUSE_RATE = 0.1;

/**
 * Records a send, failure or refusal. After a delivery failure, pauses the
 * account's sending through intro if bounces cross the threshold — their own
 * email keeps working.
 */
export async function recordOutbound(
  input: { accountId: string; leadId: string; toHash: string; step: number; subject: string; body: string; status: "sent" | "failed" | "refused"; failures?: string[]; error?: string },
  database: Database = defaultDb,
): Promise<{ paused: boolean }> {
  const { variantHash } = await import("../gate");
  await database.insert(outbound).values({ ...input, variantHash: variantHash(input.body), failures: input.failures ?? [], error: input.error?.slice(0, 300) ?? null });
  if (input.status !== "failed") return { paused: false };
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [r] = await database.select({
    failed: sql<number>`sum(case when ${outbound.status} = 'failed' then 1 else 0 end)`,
    total: sql<number>`sum(case when ${outbound.status} in ('sent','failed') then 1 else 0 end)`,
  }).from(outbound).where(and(eq(outbound.accountId, input.accountId), sql`${outbound.createdAt} >= ${since}`));
  const failed = Number(r?.failed ?? 0), total = Number(r?.total ?? 0);
  if (failed >= PAUSE_FAILURES && failed / Math.max(total, 1) >= PAUSE_RATE) {
    await commit(database, [
      database.update(accounts).set({ frozenAt: nowIso(), frozenReason: `auto: ${failed} delivery failures in 7 days` }).where(and(eq(accounts.id, input.accountId), sql`${accounts.frozenAt} IS NULL`)),
      audit(database, "system", input.accountId, "account.paused", `${failed}/${total} failed`),
    ]);
    return { paused: true };
  }
  return { paused: false };
}

/** Adds an address to the do-not-contact list (opt-outs, complaints, hard bounces). */
export async function suppressEmail(email: string, reason: "unsubscribed" | "complained" | "bounced" | "manual", source: string, database: Database = defaultDb): Promise<void> {
  const { hashEmail } = await import("../suppression");
  await database.insert(suppressions).values({ emailHash: hashEmail(email), reason, source }).onConflictDoNothing();
}

/** Verifies an account whose work email sits on its company's own domain (lib/outbound.ts). */
export async function verifyByWorkEmail(accountId: string, linkedinUrl: string, companyWebsite: string, database: Database = defaultDb): Promise<void> {
  await commit(database, [
    database.update(accounts).set({ state: "verified", verifiedAt: nowIso(), linkedinUrl, companyWebsite, activationRequestedAt: nowIso(), activationNote: "auto: work email matches company domain" })
      .where(and(eq(accounts.id, accountId), eq(accounts.state, "observer"))),
    audit(database, "system", accountId, "account.verified", "work email domain"),
  ]);
}

/** What went wrong in the last day, for the admins' morning alert (lib/alerts.ts). */
export async function alertSummary(since: Date, database: Database = defaultDb) {
  const s = since.toISOString();
  const [[emails], [searches], [stuck], paused, [outFail]] = await Promise.all([
    database.select({ n: sql<number>`count(*)` }).from(emailLog).where(and(eq(emailLog.status, "failed"), sql`${emailLog.createdAt} >= ${s}`)),
    database.select({ n: sql<number>`count(*)` }).from(searchLog).where(and(sql`json_extract(${searchLog.query}, '$.error') IS NOT NULL`, sql`${searchLog.createdAt} >= ${s}`)),
    database.select({ n: sql<number>`count(*)` }).from(signups).where(and(sql`${signups.verifiedAt} IS NULL`, sql`${signups.createdAt} >= ${s}`)),
    database.select({ email: accounts.email, reason: accounts.frozenReason }).from(accounts).where(sql`${accounts.frozenAt} >= ${s}`),
    database.select({ n: sql<number>`count(*)` }).from(outbound).where(and(eq(outbound.status, "failed"), sql`${outbound.createdAt} >= ${s}`)),
  ]);
  const recentErrors = await database.select({ kind: emailLog.kind, to: emailLog.to, error: emailLog.error }).from(emailLog)
    .where(and(eq(emailLog.status, "failed"), sql`${emailLog.createdAt} >= ${s}`)).orderBy(sql`${emailLog.createdAt} desc`).limit(5);
  return {
    emailFailures: Number(emails?.n ?? 0), searchErrors: Number(searches?.n ?? 0), stuckSignups: Number(stuck?.n ?? 0),
    outreachFailures: Number(outFail?.n ?? 0), paused, recentErrors,
  };
}

export async function adminAddresses(database: Database = defaultDb): Promise<string[]> {
  const { adminEmails } = await import("../session");
  const granted = await database.select({ email: accounts.email }).from(accounts).where(eq(accounts.role, "admin"));
  return [...new Set([...adminEmails(), ...granted.map((a) => a.email.toLowerCase())])];
}

/** Rewrites an unconfirmed request's brief (editing picks on /new before running it). */
export async function updateRequestBrief(
  requestId: string, accountId: string, input: { rawText: string; brief: Brief; sectors: string[] }, database: Database = defaultDb,
): Promise<boolean> {
  const rows = await database.update(requests)
    .set({ rawText: input.rawText, brief: input.brief, goalType: input.brief.goalType, sectors: input.sectors })
    .where(and(eq(requests.id, requestId), eq(requests.accountId, accountId), eq(requests.status, "intent_review"), sql`${requests.confirmedAt} IS NULL`))
    .returning({ id: requests.id });
  return rows.length > 0;
}
