export type Role = "requester" | "account_manager";

/**
 * Access model: the intake is open, the sending is gated. An `observer` signs
 * up freely and goes all the way to a published pipeline; only sending needs
 * verification. Reaching the send gate is the qualification signal.
 */
export type AccountState = "observer" | "verified" | "managed";

/** The reputation pool a message goes out on. Never share one across pools. */
export type SendPool = "transactional" | "intro_request" | "user_mailbox";

/** Why a send was refused. Ordered roughly by how final each refusal is. */
export type GateFailure =
  | "account_not_verified"
  | "account_frozen"
  | "recipient_suppressed"
  | "recipient_cooldown"
  | "already_contacted"
  | "daily_cap_reached"
  | "insufficient_credits"
  | "near_duplicate"
  | "no_channel";

export type LedgerReason =
  | "purchase"
  | "grant"
  | "send"
  | "refund_bounce"
  | "refund_suppressed"
  | "bonus_accept";

export type RequestStatus =
  | "intent_review"
  | "in_sourcing"
  | "pipeline_ready"
  | "outreach"
  | "closed";

export type GoalType = "job" | "sales" | "partnership" | "investment" | "person";
export type Fit = "strong" | "medium" | "possible";
export type Channel = "intro" | "email" | "linkedin";
export type PipelineSource =
  | "ai_generated"
  | "manual"
  | "imported_csv"
  | "pasted"
  | "from_list";
export type PipelineStatus = "draft" | "published" | "superseded";
export type ItemStatus = "proposed" | "approved" | "removed";
export type OutreachStatus =
  | "none"
  | "queued"
  | "sent"
  | "replied"
  | "accepted"
  | "declined";

export interface Person {
  id: string;
  latin: string;
  firstAr: string;
  title: string;
  company: string;
  geo: string;
  industries: string[];
  seniority: string;
  linkedinUrl?: string;
  email?: string;
  emailVerified: boolean;
  openToIntros: boolean;
  source: "seed" | "ai" | "am" | "import";
}

export interface Evidence {
  url: string;
  title: string;
  source: string;
  date: string;
  assertedBy: "ai" | "am";
}

export interface PipelineItem {
  id: string;
  personId: string;
  rank: number;
  fit: Fit;
  thin: boolean;
  why: string;
  whyNow: string;
  roleRelevance: string;
  companyRelevance: string;
  timing: string;
  leadWith: string;
  avoid: string;
  opener: string;
  channel: Channel;
  status: ItemStatus;
  amNote?: string;
  evidence: Evidence[];
  generatedBy: "ai" | "am";
}

export interface Pipeline {
  id: string;
  requestId: string;
  version: number;
  source: PipelineSource;
  status: PipelineStatus;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  note?: string;
  items: PipelineItem[];
}

export interface Brief {
  goalType: GoalType;
  targetRoles: string[];
  seniority: string[];
  industries: string[];
  geos: string[];
  sizeMin?: number;
  sizeMax?: number;
  inclusions: string[];
  exclusions: string[];
  summaryAr: string;
  confidence: number;
  extractedBy: "claude" | "rules";
}

export interface IntroRequest {
  id: string;
  /** Owning account — the anchor every scoped query and cap check hangs off. */
  accountId: string;
  requesterName: string;
  requesterInitial: string;
  rawText: string;
  status: RequestStatus;
  brief?: Brief;
  confirmedAt?: string;
  assignedAm: string;
  createdAt: string;
  dueAt: string;
}

/**
 * Outreach is keyed by (requestId, personId) rather than by pipeline item, so a
 * sent message or an open intro survives a pipeline being replaced. This is the
 * mechanism behind "attaching a new version never loses state".
 */
export interface Outreach {
  requestId: string;
  personId: string;
  channel: Channel;
  status: OutreachStatus;
  updatedAt: string;
}

export interface Account {
  id: string;
  displayName: string;
  initial: string;
  email: string;
  state: AccountState;
  verifiedAt?: string;
  /** Hard ceiling on sends per day. Deliberately independent of credit balance. */
  dailyCap: number;
  /** Set when the complaint-rate circuit breaker trips; cleared by an AM. */
  frozenAt?: string;
  frozenReason?: string;
  assignedAm?: string;
  createdAt: string;
}

/**
 * Append-only. The balance is a projection over this ledger, never a mutable
 * column — so a refund is a new row and the history stays auditable.
 */
export interface LedgerEntry {
  id: string;
  accountId: string;
  delta: number;
  reason: LedgerReason;
  ref?: string;
  at: string;
}

/**
 * A target who opts out is out everywhere, across every account. Stored as a
 * hash so the suppression list is not itself a mailing list.
 */
export interface Suppression {
  emailHash: string;
  reason: "unsubscribed" | "complained" | "bounced" | "manual";
  source: string;
  createdAt: string;
}

export interface SendAttempt {
  id: string;
  accountId: string;
  requestId: string;
  personId: string;
  pool: SendPool;
  channel: Channel;
  /** What was actually sent — the audit trail, and the near-duplicate corpus. */
  body: string;
  /** Shingle hash of the body, for exact-repeat detection across recipients. */
  variantHash: string;
  result: "allowed" | "refused";
  gateFailures: GateFailure[];
  providerMessageId?: string;
  at: string;
}

export interface PeopleList {
  id: string;
  name: string;
  desc: string;
  personIds: string[];
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  entity: string;
  action: string;
  detail: string;
}

export interface Db {
  accounts: Account[];
  people: Person[];
  requests: IntroRequest[];
  pipelines: Pipeline[];
  outreach: Outreach[];
  lists: PeopleList[];
  ledger: LedgerEntry[];
  suppressions: Suppression[];
  sendAttempts: SendAttempt[];
  audit: AuditEvent[];
}
