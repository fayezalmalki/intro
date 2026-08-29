import { sql } from "drizzle-orm";
import {
  pgTable, text, integer, boolean, timestamp, jsonb, uuid,
  primaryKey, uniqueIndex, index, check,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type {
  AccountState, Channel, CheckoutStatus, CountSource, DraftLang, DraftSpecific,
  DraftStatus, DraftTemplate, Evidence, ExampleCompany, Fit, GateFailure,
  GoalType, GtmRunStatus, GtmStep, ItemStatus, LedgerReason, OutreachStatus,
  PipelineSource, PipelineStatus, ProfileSource, RequestStatus, Role,
  SegmentOrigin, SendPool, UsageKind,
} from "../types";
import type { EmailStatus } from "../coresignal.types";

// ── NextAuth tables — copied from about-sa so the DrizzleAdapter works ──

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const authAccounts = pgTable("auth_accounts", {
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authVerificationTokens = pgTable("auth_verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

/**
 * One-time sign-in codes.
 *
 * `codeHash` is a sha256 of the code, never the code itself: this table is the
 * whole credential for an address, and a database dump or a stray log line
 * that carried live codes would be an account takeover for every address with
 * one outstanding. Ported from careers.sa `convex/authEmailDb.ts`, which holds
 * the same four rules: single-use, latest-code-only, at most MAX_ATTEMPTS
 * wrong guesses per code, at most MAX_SENDS_PER_WINDOW sends per window.
 *
 * `attempts`, `sendCount` and `firstSentAt` are what make those last two
 * enforceable in a serverless runtime: instances share no memory, so an
 * in-process counter would reset on every cold start and limit nothing.
 */
export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  /** Wrong guesses against this code. At the limit the row is destroyed. */
  attempts: integer("attempts").notNull().default(0),
  /** Sends inside the window that opened at `firstSentAt`. */
  sendCount: integer("send_count").notNull().default(1),
  firstSentAt: timestamp("first_sent_at", { mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => [index("otp_codes_email_idx").on(t.email)]);

// ── Accounts ──────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  initial: text("initial").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<Role>().notNull().default("requester"),
  state: text("state").$type<AccountState>().notNull().default("observer"),
  verifiedAt: timestamp("verified_at", { mode: "string" }),
  dailyCap: integer("daily_cap").notNull().default(10),
  frozenAt: timestamp("frozen_at", { mode: "string" }),
  frozenReason: text("frozen_reason"),
  assignedAm: text("assigned_am"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("accounts_user_id_idx").on(t.userId)]);

// ── People graph ──────────────────────────────────────────────

export const people = pgTable("people", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  latin: text("latin").notNull(),
  firstAr: text("first_ar").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  geo: text("geo").notNull(),
  industries: jsonb("industries").$type<string[]>().notNull().default([]),
  seniority: text("seniority").notNull(),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  openToIntros: boolean("open_to_intros").notNull().default(false),
  source: text("source").$type<"seed" | "ai" | "am" | "import">().notNull(),
}, (t) => [
  uniqueIndex("people_linkedin_idx").on(t.linkedinUrl),
  index("people_email_idx").on(t.email),
]);

export const peopleLists = pgTable("people_lists", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const listMembers = pgTable("list_members", {
  listId: text("list_id").notNull().references(() => peopleLists.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.listId, t.personId] })]);

// ── Requests and pipelines ────────────────────────────────────

export const requests = pgTable("requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requesterName: text("requester_name").notNull(),
  requesterInitial: text("requester_initial").notNull(),
  rawText: text("raw_text").notNull(),
  status: text("status").$type<RequestStatus>().notNull(),
  goalType: text("goal_type").$type<GoalType>(),
  brief: jsonb("brief"),
  confirmedAt: timestamp("confirmed_at", { mode: "string" }),
  // Nullable: a request is unassigned until an account manager claims it.
  assignedAm: text("assigned_am"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { mode: "string" }).notNull(),
}, (t) => [index("requests_account_idx").on(t.accountId)]);

export const pipelines = pgTable("pipelines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  source: text("source").$type<PipelineSource>().notNull(),
  status: text("status").$type<PipelineStatus>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { mode: "string" }),
  note: text("note"),
}, (t) => [
  uniqueIndex("pipelines_request_version_idx").on(t.requestId, t.version),
  index("pipelines_request_status_idx").on(t.requestId, t.status),
]);

export const pipelineItems = pgTable("pipeline_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  pipelineId: text("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  fit: text("fit").$type<Fit>().notNull(),
  thin: boolean("thin").notNull().default(false),
  why: text("why").notNull(),
  whyNow: text("why_now").notNull(),
  roleRelevance: text("role_relevance").notNull(),
  companyRelevance: text("company_relevance").notNull(),
  timing: text("timing").notNull(),
  leadWith: text("lead_with").notNull(),
  avoid: text("avoid").notNull(),
  opener: text("opener").notNull(),
  channel: text("channel").$type<Channel>().notNull(),
  status: text("status").$type<ItemStatus>().notNull(),
  amNote: text("am_note"),
  evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
  generatedBy: text("generated_by").$type<"ai" | "am">().notNull(),
}, (t) => [index("pipeline_items_pipeline_idx").on(t.pipelineId)]);

// ── Outreach ──────────────────────────────────────────────────

/**
 * Keyed by (request, person) rather than by pipeline item, so a sent message
 * or an open intro survives a pipeline being replaced.
 */
export const outreach = pgTable("outreach", {
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  channel: text("channel").$type<Channel>().notNull(),
  status: text("status").$type<OutreachStatus>().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.requestId, t.personId] })]);

export const sendAttempts = pgTable("send_attempts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  pool: text("pool").$type<SendPool>().notNull(),
  channel: text("channel").$type<Channel>().notNull(),
  body: text("body").notNull(),
  variantHash: text("variant_hash").notNull(),
  result: text("result").$type<"allowed" | "refused">().notNull(),
  gateFailures: jsonb("gate_failures").$type<GateFailure[]>().notNull().default([]),
  providerMessageId: text("provider_message_id"),
  at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  index("send_attempts_account_at_idx").on(t.accountId, t.at),
  index("send_attempts_person_idx").on(t.personId),
]);

/**
 * A target who opts out is out everywhere. Hashed so the suppression list is
 * not itself a usable mailing list.
 */
export const suppressions = pgTable("suppressions", {
  emailHash: text("email_hash").primaryKey(),
  reason: text("reason").$type<"unsubscribed" | "complained" | "bounced" | "manual">().notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

// ── Money ─────────────────────────────────────────────────────

/**
 * Append-only. Balance is a projection, never a column.
 *
 * The unique index on (account_id, reason, ref) is what makes credit grants
 * idempotent: a retried StreamPay webhook carrying the same invoice id as
 * `ref` writes nothing the second time. Without it, a provider retry is free
 * money — see docs/03-design-review.md.
 */
export const ledger = pgTable("ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").$type<LedgerReason>().notNull(),
  ref: text("ref"),
  at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ledger_idempotency_idx").on(t.accountId, t.reason, t.ref),
  index("ledger_account_idx").on(t.accountId),
]);

// ── Audit ─────────────────────────────────────────────────────

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  entity: text("entity").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
}, (t) => [index("audit_entity_idx").on(t.entity)]);

/**
 * Product instrumentation: one row per moment worth counting.
 *
 * Deliberately separate from `auditEvents`, which answers "who changed what"
 * and is written inside the transaction that made the change. This answers
 * "how is the funnel doing", is written best-effort outside any transaction,
 * and must never be able to fail the thing it is measuring — see lib/usage.ts.
 */
export const usageEvents = pgTable("usage_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text("kind").$type<UsageKind>().notNull(),
  /** Null for events that happen before an account exists — OTP sends, mostly. */
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  email: text("email"),
  /** Small JSON blob; the shape varies per kind and nothing queries inside it. */
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  index("usage_events_kind_at_idx").on(t.kind, t.at),
  index("usage_events_at_idx").on(t.at),
]);

/**
 * Every call to a metered vendor API, and what it cost.
 *
 * Two jobs, and the second is why `argsHash` is unique rather than merely
 * indexed: it is the record of spend for the ops page, and it is the dedupe
 * key that stops the same paid lookup being bought twice. A Coresignal
 * employee collect is 20 credits; repeating one because a retry lost its
 * result is 20 credits of nothing. `response` holds the payload so the second
 * caller is served from here instead of from the vendor.
 *
 * `creditsRemaining` is the `x-credits-remaining` header as of that call — the
 * only place the balance is observable without spending anything to ask.
 */
export const apiCallLog = pgTable("api_call_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull(),
  endpoint: text("endpoint").notNull(),
  argsHash: text("args_hash").notNull(),
  creditsSpent: integer("credits_spent").notNull().default(0),
  creditsRemaining: integer("credits_remaining"),
  /** The account whose work caused the spend. Null for calls we make for ourselves. */
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  response: jsonb("response"),
  at: timestamp("at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  // Partial on purpose. A purchase must happen once, so paid rows are unique
  // on their arguments; a search is meant to be repeatable and its results
  // change, so free rows (credits_spent = 0) are outside the constraint and
  // accumulate as the call log they are.
  uniqueIndex("api_call_log_args_idx")
    .on(t.provider, t.endpoint, t.argsHash)
    .where(sql`${t.creditsSpent} > 0`),
  index("api_call_log_at_idx").on(t.at),
]);

/**
 * The raw inbound webhook log, and nothing else yet.
 *
 * `(provider, eventId)` is unique because every payment provider retries, and
 * a retry that credits an account twice is free money — the same argument as
 * `ledger_idempotency_idx`, one layer earlier. Recording the event and acting
 * on it are separate steps on purpose: the insert is what makes the handler
 * idempotent, so it has to succeed or conflict before any work is done.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: jsonb("payload"),
  receivedAt: timestamp("received_at", { mode: "string" }).notNull().defaultNow(),
  /** Set when the handler finished with it; null means received but unprocessed. */
  processedAt: timestamp("processed_at", { mode: "string" }),
}, (t) => [uniqueIndex("webhook_events_provider_event_idx").on(t.provider, t.eventId)]);

// ── The GTM flow ──────────────────────────────────────────────
//
// Self-serve, unattended, vendor-sourced: a website in, and segments,
// companies, decision makers and an Arabic opener out. Kept apart from
// `requests`/`pipelines` on purpose — that loop is account-manager work with an
// SLA and an evidence gate, and collapsing the two would put a 24-hour SLA on a
// screen nobody is waiting on.

/**
 * One pass through the flow, and the record of how it went.
 *
 * `steps` is a jsonb array rather than a table because nothing queries inside
 * it: it is read whole to render the rail and written whole when a step moves.
 * A step that failed keeps its message here, which is what lets the screen say
 * *what* broke instead of spinning.
 */
export const gtmRuns = pgTable("gtm_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  websiteUrl: text("website_url").notNull(),
  status: text("status").$type<GtmRunStatus>().notNull().default("running"),
  steps: jsonb("steps").$type<GtmStep[]>().notNull().default([]),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [index("gtm_runs_account_idx").on(t.accountId)]);

/**
 * What we believe the user's own company does, and where that belief came from.
 *
 * `source` is not decoration. `claude` means a model read the page, `html`
 * means we fell back to the page's own metadata, and `manual` means a person
 * typed it after a step failed. The composer treats all three as equally
 * quotable *about the sender* — it is their own company — but the screen says
 * which, so nobody mistakes a meta-description for research.
 */
export const companyProfiles = pgTable("company_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull().references(() => gtmRuns.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  websiteUrl: text("website_url").notNull(),
  name: text("name").notNull(),
  /** One line, in Arabic: what they sell and to whom. */
  sells: text("sells").notNull().default(""),
  market: text("market").notNull().default(""),
  sizeSignal: text("size_signal").notNull().default(""),
  language: text("language").notNull().default("ar"),
  offerings: jsonb("offerings").$type<string[]>().notNull().default([]),
  competitors: jsonb("competitors").$type<ExampleCompany[]>().notNull().default([]),
  source: text("source").$type<ProfileSource>().notNull(),
  /** The page text the profile was read from, trimmed. Provenance, not content. */
  sourceExcerpt: text("source_excerpt").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [uniqueIndex("company_profiles_run_idx").on(t.runId)]);

/**
 * A candidate campaign: who to go after, why they hurt, and how many there are.
 *
 * `countQuery` sits beside `matchCount` and is the reason both are here. Phase
 * 0 established that these totals swing hard with query strictness, so a number
 * without the query that produced it is a number nobody can check. The UI
 * renders the query next to the count, and when `countSource` is `unavailable`
 * it renders no number at all — an unsourceable count is not displayed, ever.
 */
export const segments = pgTable("segments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull().references(() => gtmRuns.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull().default(0),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("◆"),
  description: text("description").notNull().default(""),
  pain: text("pain").notNull().default(""),
  criteria: jsonb("criteria").$type<string[]>().notNull().default([]),
  exampleCompanies: jsonb("example_companies").$type<ExampleCompany[]>().notNull().default([]),
  /** Null unless a real free search returned an `x-total-results` for it. */
  matchCount: integer("match_count"),
  countQuery: jsonb("count_query"),
  countEndpoint: text("count_endpoint"),
  countSource: text("count_source").$type<CountSource>().notNull().default("unavailable"),
  /** Why there is no count, in one line — shown instead of the number. */
  countError: text("count_error"),
  countedAt: timestamp("counted_at", { mode: "string" }),
  origin: text("origin").$type<SegmentOrigin>().notNull().default("ai"),
  removedAt: timestamp("removed_at", { mode: "string" }),
}, (t) => [
  index("segments_run_idx").on(t.runId),
  // A count may only exist alongside the query that produced it. The rule the
  // product rests on, held one layer below the code that could forget it.
  check(
    "segments_count_needs_query",
    sql`${t.matchCount} is null or (${t.countQuery} is not null and ${t.countSource} = 'coresignal')`,
  ),
]);

/**
 * A company that matched a segment's free search.
 *
 * `kept` is the cost boundary. Rows arrive from a free search and cost nothing;
 * only a kept row may ever be handed to a paid collect, and `enrichedAt` marks
 * the ones that were. Everything else on this table is what the free search
 * already told us.
 */
export const targetCompanies = pgTable("target_companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  coresignalId: integer("coresignal_id"),
  name: text("name").notNull(),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  employeesCount: integer("employees_count"),
  industry: text("industry"),
  hqCountry: text("hq_country"),
  kept: boolean("kept").notNull().default(false),
  enrichedAt: timestamp("enriched_at", { mode: "string" }),
  source: text("source").$type<"search" | "collect" | "manual" | "fixture">().notNull().default("search"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [index("target_companies_segment_idx").on(t.segmentId)]);

/**
 * A decision maker, and how far their address may be trusted.
 *
 * `emailStatus` is stored rather than reduced to a boolean because the four
 * values are not two: `matched_pattern` and `guessed_common_pattern` are both
 * "not verified", but only the second is literally a guess, and the review
 * screen says so in those words. See lib/coresignal.types.ts.
 */
export const targetPeople = pgTable("target_people", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").references(() => targetCompanies.id, { onDelete: "cascade" }),
  segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  coresignalId: integer("coresignal_id"),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  title: text("title").notNull().default(""),
  companyName: text("company_name").notNull().default(""),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  emailStatus: text("email_status").$type<EmailStatus>(),
  /** Explicitly kept by the user. Only a kept row may be collected. */
  kept: boolean("kept").notNull().default(false),
  /** Set when 20 credits were actually spent on this row. */
  collectedAt: timestamp("collected_at", { mode: "string" }),
  source: text("source").$type<"search" | "collect" | "manual" | "fixture">().notNull().default("search"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  index("target_people_segment_idx").on(t.segmentId),
  index("target_people_company_idx").on(t.companyId),
  // An address without a status would be an address of unknown provenance,
  // which is the one thing the email gate exists to prevent.
  check(
    "target_people_email_needs_status",
    sql`${t.email} is null or ${t.emailStatus} is not null`,
  ),
]);

/**
 * The opener, in Arabic and in English, and what it was allowed to cite.
 *
 * `specifics` is the honesty record: every concrete claim in the body, paired
 * with the field it came from. A draft with an empty `specifics` is a draft
 * that had nothing true to say, and the composer writes a shorter opener rather
 * than inventing one — lib/gtm/compose.ts holds that rule and its tests.
 *
 * The CHECK is the centre of the whole review screen: `sent` cannot be written
 * without a provider message id. Not a convention, not a code review note — a
 * constraint, so a future send path that forgets fails its INSERT.
 */
export const introDrafts = pgTable("intro_drafts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text("person_id").notNull().references(() => targetPeople.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  template: text("template").$type<DraftTemplate>().notNull().default("direct"),
  lang: text("lang").$type<DraftLang>().notNull().default("ar"),
  subjectAr: text("subject_ar").notNull().default(""),
  bodyAr: text("body_ar").notNull().default(""),
  subjectEn: text("subject_en").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  specifics: jsonb("specifics").$type<DraftSpecific[]>().notNull().default([]),
  status: text("status").$type<DraftStatus>().notNull().default("prepared"),
  /** The only thing that may accompany `sent`, and the constraint says so. */
  providerMessageId: text("provider_message_id"),
  sentAt: timestamp("sent_at", { mode: "string" }),
  editedByUser: boolean("edited_by_user").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("intro_drafts_person_idx").on(t.personId),
  index("intro_drafts_segment_idx").on(t.segmentId),
  check(
    "intro_drafts_sent_needs_provider_id",
    sql`${t.status} <> 'sent' or ${t.providerMessageId} is not null`,
  ),
]);

/**
 * A checkout, from the moment the paywall is accepted to the moment a provider
 * webhook settles it.
 *
 * Credits are not granted from here — the webhook writes a `ledger` row with
 * this checkout's id as `ref`, and `ledger_idempotency_idx` absorbs the retry.
 * This table exists so an unsettled checkout is visible as unsettled rather
 * than as a user who paid and got nothing.
 */
export const checkouts = pgTable("checkouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  /** The provider's own id for this checkout. Unique per provider. */
  providerRef: text("provider_ref").notNull(),
  /** One StreamPay account serves several apps; every row is tagged. */
  product: text("product").notNull().default("intro"),
  credits: integer("credits").notNull(),
  /** In halalas, so money is never a float. */
  amountHalalas: integer("amount_halalas").notNull(),
  currency: text("currency").notNull().default("SAR"),
  status: text("status").$type<CheckoutStatus>().notNull().default("created"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { mode: "string" }),
}, (t) => [
  uniqueIndex("checkouts_provider_ref_idx").on(t.provider, t.providerRef),
  index("checkouts_account_idx").on(t.accountId),
]);
