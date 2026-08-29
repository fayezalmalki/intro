/**
 * What an account may do, as opposed to `AccountState`, which is how far it has
 * been trusted to send. A requester with `state: "verified"` can send; only an
 * account_manager can approve a pipeline and publish it to someone.
 */
export type Role = "requester" | "account_manager" | "admin";

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

/**
 * The moments worth counting, and the whole vocabulary of `usageEvents`.
 *
 * A closed union rather than a free string: an ops page that reads events
 * nobody writes, or misses a kind because it was spelled two ways, measures
 * nothing. Kept small on purpose — instrument the decision points, not every
 * click.
 */
export type UsageKind =
  /** Someone asked to be allowed to send — the top of the money funnel. */
  | "unlock_click"
  /** A send the gate refused, with the failures in `meta`. */
  | "send_refused"
  /** A send the gate allowed. */
  | "send_allowed"
  /** An OTP left the building. */
  | "otp_sent"
  /** SMTP refused it, classified — the one that means login is broken. */
  | "otp_send_failed"
  /** A code was accepted. */
  | "otp_verified"
  /** A code was rejected: wrong, expired, or out of attempts. */
  | "otp_verify_failed"
  /** First sign-in for an address — an account row now exists. */
  | "account_created"
  /** A website was submitted to the GTM flow — the top of the self-serve funnel. */
  | "gtm_run_started"
  /** A run step failed and asked the user to correct it by hand. */
  | "gtm_step_failed"
  /** Paid enrichment was confirmed, with the credit count in `meta`. */
  | "collect_confirmed"
  /** A checkout was created — the paywall was reached and accepted. */
  | "checkout_started"
  /** A checkout was settled by a provider webhook. */
  | "checkout_paid";

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
  assignedAm?: string;
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
  userId: string;
  role: Role;
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

// ── GTM flow ──────────────────────────────────────────────────
//
// The self-serve path: a website goes in, and segments, companies, decision
// makers and an Arabic opener come out. Deliberately its own vocabulary rather
// than reusing `requests`/`pipelines`: that loop is account-manager work with
// an SLA and an evidence gate, this one is unattended and vendor-sourced, and
// collapsing the two would put a 24-hour SLA on a screen nobody is waiting on.

/** The visible steps of a run, in order. The rail on /gtm renders exactly this. */
export type GtmStepId =
  | "profile"
  | "competitors"
  | "segments"
  | "companies"
  | "people"
  | "drafts";

export const GTM_STEPS: readonly GtmStepId[] = [
  "profile",
  "competitors",
  "segments",
  "companies",
  "people",
  "drafts",
];

/**
 * Four states, and `failed` is the one that earns its keep: a step that cannot
 * complete says what failed and offers the manual correction, rather than
 * spinning. Nothing here is ever "done" without the row it claims to produce.
 */
export type GtmStepState = "pending" | "running" | "done" | "failed";

export interface GtmStep {
  id: GtmStepId;
  state: GtmStepState;
  /** What it produced, in one line, when it succeeded. */
  note?: string;
  /** What went wrong, in one line, when it did not. Shown to the user. */
  error?: string;
  at?: string;
}

export type GtmRunStatus = "running" | "ready" | "failed";

/** How a company profile was arrived at. `manual` means a person typed it. */
export type ProfileSource = "claude" | "html" | "manual";

/**
 * Where a segment's company count came from.
 *
 * `unavailable` is a first-class value, not an error state: without a
 * Coresignal key there is no honest number, and a count we cannot source from
 * a real query must not be rendered at all. See lib/gtm/counts.ts.
 */
export type CountSource = "coresignal" | "unavailable";

export type SegmentOrigin = "ai" | "rules" | "user";

/** The three openers the composer can write. */
export type DraftTemplate = "direct" | "warm_intro" | "partnership";

/**
 * `sent` is reachable only from a send path that returned a real provider
 * message id — the database holds that with a CHECK constraint, so no code
 * path, present or future, can mark a draft sent without one.
 */
export type DraftStatus = "prepared" | "approved" | "sent" | "rejected";

export type DraftLang = "ar" | "en";

export type CheckoutStatus = "created" | "paid" | "failed" | "expired";

export interface ExampleCompany {
  name: string;
  website?: string;
  /**
   * Where the name came from, and therefore whether it may be shown as fact.
   *
   * `coresignal` means a free search actually returned this company. `analysis`
   * means the model named it from its own knowledge — a claim about a real
   * company that nobody checked, so the UI renders it as an unverified
   * suggestion rather than a result. There is no third option: a name with no
   * provenance does not get displayed.
   */
  source?: "coresignal" | "analysis";
}

/** A fact about the recipient that the draft is allowed to cite. */
export interface DraftSpecific {
  /** The claim, in the draft's language. */
  text: string;
  /** Where it came from — a field name, never a guess. */
  field: string;
}
