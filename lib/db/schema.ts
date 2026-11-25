import { sql } from "drizzle-orm";
import {
  sqliteTable, text, integer, primaryKey, uniqueIndex, index,
} from "drizzle-orm/sqlite-core";
import type {
  AccountState, Channel, Evidence, Fit, GateFailure, GoalType, ItemStatus,
  LedgerReason, OutreachStatus, PipelineSource, PipelineStatus, RequestStatus,
  Role, SendPool,
} from "../types";

/**
 * D1 (SQLite). Conventions:
 * - ids are text, generated in JS with crypto.randomUUID().
 * - domain timestamps are ISO-8601 text (`2026-11-25T17:00:00.000Z`), so string
 *   comparison is chronological and a UTC date prefix is `slice(0, 10)`.
 * - Better Auth tables store dates as integer milliseconds, which its Drizzle
 *   adapter expects.
 * - JSON columns are text with mode "json".
 */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const now = () => new Date().toISOString();
const isoNow = (name: string) => text(name).notNull().$defaultFn(now);
const ms = (name: string) => integer(name, { mode: "timestamp_ms" });
const bool = (name: string) => integer(name, { mode: "boolean" });

// ── Better Auth ───────────────────────────────────────────────

export const authUsers = sqliteTable("auth_users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ms("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: ms("updated_at").notNull().$defaultFn(() => new Date()),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: id(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ms("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: ms("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: ms("updated_at").notNull().$defaultFn(() => new Date()),
}, (t) => [index("auth_sessions_user_idx").on(t.userId)]);

export const authAccounts = sqliteTable("auth_accounts", {
  id: id(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ms("access_token_expires_at"),
  refreshTokenExpiresAt: ms("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ms("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: ms("updated_at").notNull().$defaultFn(() => new Date()),
}, (t) => [index("auth_accounts_user_idx").on(t.userId)]);

export const authVerifications = sqliteTable("auth_verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ms("expires_at").notNull(),
  createdAt: ms("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: ms("updated_at").notNull().$defaultFn(() => new Date()),
}, (t) => [index("auth_verifications_identifier_idx").on(t.identifier)]);

/** Better Auth's database-backed rate limiter (Worker isolates share no memory). */
export const authRateLimits = sqliteTable("auth_rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

// ── Accounts ──────────────────────────────────────────────────

export const accounts = sqliteTable("accounts", {
  id: id(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  initial: text("initial").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<Role>().notNull().default("requester"),
  state: text("state").$type<AccountState>().notNull().default("observer"),
  verifiedAt: text("verified_at"),
  dailyCap: integer("daily_cap").notNull().default(10),
  frozenAt: text("frozen_at"),
  frozenReason: text("frozen_reason"),
  assignedAm: text("assigned_am"),
  // Onboarding (/welcome): who they are and what they came for. Null
  // onboardedAt sends every app page to /welcome first.
  company: text("company"),
  companyWebsite: text("company_website"),
  jobTitle: text("job_title"),
  useCase: text("use_case"),
  linkedinUrl: text("linkedin_url"),
  locale: text("locale").$type<"ar" | "en">().notNull().default("ar"),
  onboardedAt: text("onboarded_at"),
  // Activation (/activate): an observer asking to send. An admin approves it
  // in /am/team (verifyAccount), which clears nothing here — verifiedAt wins.
  activationRequestedAt: text("activation_requested_at"),
  activationNote: text("activation_note"),
  createdAt: isoNow("created_at"),
}, (t) => [uniqueIndex("accounts_user_id_idx").on(t.userId)]);

// ── People graph ──────────────────────────────────────────────

export const people = sqliteTable("people", {
  id: id(),
  latin: text("latin").notNull(),
  firstAr: text("first_ar").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  companyDomain: text("company_domain"),
  geo: text("geo").notNull(),
  industries: text("industries", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  seniority: text("seniority").notNull(),
  linkedinUrl: text("linkedin_url"),
  // Bought only once a requester approves the person (PDPL: minimum data).
  email: text("email"),
  emailVerified: bool("email_verified").notNull().default(false),
  openToIntros: bool("open_to_intros").notNull().default(false),
  source: text("source").$type<"seed" | "ai" | "am" | "import" | "provider">().notNull(),
  // Which data provider answered (treg `_treg.served_by`), for provenance.
  servedBy: text("served_by"),
  updatedAt: isoNow("updated_at"),
}, (t) => [
  uniqueIndex("people_linkedin_idx").on(t.linkedinUrl),
  index("people_email_idx").on(t.email),
  index("people_company_domain_idx").on(t.companyDomain),
]);

export const peopleLists = sqliteTable("people_lists", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const listMembers = sqliteTable("list_members", {
  listId: text("list_id").notNull().references(() => peopleLists.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.listId, t.personId] })]);

// ── Requests and pipelines ────────────────────────────────────

export const requests = sqliteTable("requests", {
  id: id(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requesterName: text("requester_name").notNull(),
  requesterInitial: text("requester_initial").notNull(),
  rawText: text("raw_text").notNull(),
  status: text("status").$type<RequestStatus>().notNull(),
  goalType: text("goal_type").$type<GoalType>(),
  // The predefined use case the request started from, if any (src/content/use-cases.ts).
  useCase: text("use_case"),
  sectors: text("sectors", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  brief: text("brief", { mode: "json" }),
  confirmedAt: text("confirmed_at"),
  // Nullable: a request is unassigned until an account manager claims it.
  assignedAm: text("assigned_am"),
  // Running sourcing spend in micro-USD (sum of treg X-Treg-Cost-Micro).
  sourcingCostMicro: integer("sourcing_cost_micro").notNull().default(0),
  workflowId: text("workflow_id"),
  createdAt: isoNow("created_at"),
  dueAt: text("due_at").notNull(),
}, (t) => [index("requests_account_idx").on(t.accountId)]);

export const pipelines = sqliteTable("pipelines", {
  id: id(),
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  source: text("source").$type<PipelineSource>().notNull(),
  status: text("status").$type<PipelineStatus>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: isoNow("created_at"),
  publishedAt: text("published_at"),
  note: text("note"),
}, (t) => [
  uniqueIndex("pipelines_request_version_idx").on(t.requestId, t.version),
  index("pipelines_request_status_idx").on(t.requestId, t.status),
  // At most one published pipeline per request (docs/02-data-model.md).
  uniqueIndex("pipelines_one_published_idx").on(t.requestId).where(sql`status = 'published'`),
]);

export const pipelineItems = sqliteTable("pipeline_items", {
  id: id(),
  pipelineId: text("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  fit: text("fit").$type<Fit>().notNull(),
  thin: bool("thin").notNull().default(false),
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
  evidence: text("evidence", { mode: "json" }).$type<Evidence[]>().notNull().default(sql`'[]'`),
  generatedBy: text("generated_by").$type<"ai" | "am">().notNull(),
}, (t) => [index("pipeline_items_pipeline_idx").on(t.pipelineId)]);

// ── Outreach ──────────────────────────────────────────────────

/**
 * Keyed by (request, person) rather than by pipeline item, so a sent message
 * or an open intro survives a pipeline being replaced.
 */
export const outreach = sqliteTable("outreach", {
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  channel: text("channel").$type<Channel>().notNull(),
  status: text("status").$type<OutreachStatus>().notNull(),
  updatedAt: isoNow("updated_at"),
}, (t) => [primaryKey({ columns: [t.requestId, t.personId] })]);

export const sendAttempts = sqliteTable("send_attempts", {
  id: id(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  pool: text("pool").$type<SendPool>().notNull(),
  channel: text("channel").$type<Channel>().notNull(),
  body: text("body").notNull(),
  variantHash: text("variant_hash").notNull(),
  result: text("result").$type<"allowed" | "refused">().notNull(),
  gateFailures: text("gate_failures", { mode: "json" }).$type<GateFailure[]>().notNull().default(sql`'[]'`),
  providerMessageId: text("provider_message_id"),
  at: isoNow("at"),
}, (t) => [
  index("send_attempts_account_at_idx").on(t.accountId, t.at),
  index("send_attempts_person_idx").on(t.personId),
]);

/**
 * A target who opts out is out everywhere. Hashed so the suppression list is
 * not itself a usable mailing list.
 */
export const suppressions = sqliteTable("suppressions", {
  emailHash: text("email_hash").primaryKey(),
  reason: text("reason").$type<"unsubscribed" | "complained" | "bounced" | "manual">().notNull(),
  source: text("source").notNull(),
  createdAt: isoNow("created_at"),
});

// ── Money ─────────────────────────────────────────────────────

/**
 * Append-only. Balance is a projection, never a column.
 *
 * The unique index on (account_id, reason, ref) is what makes credit grants
 * idempotent: a retried payment webhook carrying the same invoice id as `ref`
 * writes nothing the second time. SQLite, like Postgres, treats NULLs as
 * distinct, so entries without a ref never collide.
 */
export const ledger = sqliteTable("ledger", {
  id: id(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").$type<LedgerReason>().notNull(),
  ref: text("ref"),
  at: isoNow("at"),
}, (t) => [
  uniqueIndex("ledger_idempotency_idx").on(t.accountId, t.reason, t.ref),
  index("ledger_account_idx").on(t.accountId),
]);

// ── Search and leads ──────────────────────────────────────────

/**
 * Every search an account runs (/search). The daily budget is enforced from
 * it, and cost_micro is what treg charged us, for the unit economics.
 */
export const searchLog = sqliteTable("search_log", {
  id: id(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"companies" | "people" | "person" | "news" | "email">().notNull(),
  query: text("query", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  results: integer("results").notNull().default(0),
  costMicro: integer("cost_micro").notNull().default(0),
  servedBy: text("served_by"),
  createdAt: isoNow("created_at"),
}, (t) => [index("search_log_account_day_idx").on(t.accountId, t.createdAt)]);

/**
 * A person an account saved from search. The email is bought only when they
 * reveal it (one credit, refunded on a miss), and kept with its verdict.
 */
export const leads = sqliteTable("leads", {
  id: id(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  source: text("source").$type<"search" | "request">().notNull().default("search"),
  market: text("market"),
  email: text("email"),
  emailStatus: text("email_status").$type<"valid" | "risky" | "invalid" | "not_found">(),
  revealedAt: text("revealed_at"),
  signals: text("signals", { mode: "json" }).$type<{ url: string; title: string; source: string; date?: string }[]>(),
  note: text("note"),
  createdAt: isoNow("created_at"),
}, (t) => [
  uniqueIndex("leads_account_person_idx").on(t.accountId, t.personId),
  index("leads_account_idx").on(t.accountId),
]);

// ── Audit ─────────────────────────────────────────────────────

export const auditEvents = sqliteTable("audit_events", {
  id: id(),
  at: isoNow("at"),
  actor: text("actor").notNull(),
  entity: text("entity").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
}, (t) => [index("audit_entity_idx").on(t.entity)]);
