export type Role = "requester" | "account_manager";

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
  people: Person[];
  requests: IntroRequest[];
  pipelines: Pipeline[];
  outreach: Outreach[];
  lists: PeopleList[];
  audit: AuditEvent[];
}
