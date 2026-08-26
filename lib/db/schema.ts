import {
  pgTable, text, integer, boolean, timestamp, jsonb, uuid,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type {
  AccountState, Channel, Evidence, Fit, GateFailure, GoalType, ItemStatus,
  LedgerReason, OutreachStatus, PipelineSource, PipelineStatus, RequestStatus, SendPool,
} from "../types";

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

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
}, (t) => [index("otp_codes_email_idx").on(t.email)]);

// ── Accounts ──────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  initial: text("initial").notNull(),
  email: text("email").notNull(),
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
  assignedAm: text("assigned_am").notNull(),
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
