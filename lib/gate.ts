import { createHash } from "node:crypto";
import { balanceOf, sentToday } from "./credits";
import { isSuppressed } from "./suppression";
import type { Channel, Db, GateFailure, SendPool } from "./types";

/** One message per person per requester, ever. */
const PER_REQUESTER_ONCE = true;
/** One message per person across all requesters, per this many days. */
export const GLOBAL_COOLDOWN_DAYS = 90;
/** Above this Jaccard similarity against the account's own outbound, refuse. */
export const NEAR_DUPLICATE_THRESHOLD = 0.7;

export interface SendRequest {
  accountId: string;
  requestId: string;
  personId: string;
  channel: Channel;
  body: string;
}

export interface GateResult {
  allowed: boolean;
  failures: GateFailure[];
  pool: SendPool;
  variantHash: string;
  /** Human-readable reason for the first failure, for the requester UI. */
  reason?: string;
}

const REASON: Record<GateFailure, string> = {
  account_not_verified: "حسابك ما زال بدون تفعيل للإرسال. أكمل التحقق أولًا.",
  account_frozen: "أوقفنا الإرسال من حسابك مؤقتًا بعد شكاوى. مدير حسابك يراجعها.",
  recipient_suppressed: "هذا الشخص طلب عدم التواصل معه. لا يمكن مراسلته.",
  recipient_cooldown: "تواصل معه أحد خلال آخر ٩٠ يومًا. جرّب مسارًا ثانيًا.",
  already_contacted: "أرسلت له من قبل في هذا الطلب. رسالة واحدة لكل شخص.",
  daily_cap_reached: "وصلت الحد اليومي للإرسال. كمّل بكرة.",
  insufficient_credits: "ما بقي رصيد إرسال.",
  near_duplicate: "هذي الرسالة قريبة جدًا من رسالة ثانية أرسلتها. اكتب واحدة تخص هذا الشخص.",
  no_channel: "ما عندنا طريقة تواصل موثّقة لهذا الشخص.",
};

/** Which reputation pool carries this channel. See docs/03-design-review.md §2. */
export function poolFor(channel: Channel): SendPool {
  return channel === "intro" ? "intro_request" : "user_mailbox";
}

/**
 * Normalized word shingles. Personalizing only the name leaves the shingle set
 * nearly identical, which is the point — that is the send we want to refuse.
 */
export function variantHash(body: string): string {
  return createHash("sha256").update(shingleKey(body)).digest("hex");
}

function normalize(body: string): string[] {
  return body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(body: string, n = 3): Set<string> {
  const words = normalize(body);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  if (out.size === 0 && words.length) out.add(words.join(" "));
  return out;
}

function shingleKey(body: string): string {
  return [...shingles(body)].sort().join("|");
}

export function similarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / (sa.size + sb.size - shared);
}

/**
 * The single choke point every send passes through, on every pool. Nothing
 * reaches a provider without an `allowed` result from here.
 *
 * Deliberately returns every failure rather than the first, so the UI can
 * explain the whole situation and the audit trail records it.
 */
export function canSend(db: Db, req: SendRequest, now = new Date()): GateResult {
  const failures: GateFailure[] = [];
  const account = db.accounts.find((a) => a.id === req.accountId);
  const person = db.people.find((p) => p.id === req.personId);
  const pool = poolFor(req.channel);

  if (!account || account.state === "observer") failures.push("account_not_verified");
  if (account?.frozenAt) failures.push("account_frozen");

  if (!person || (req.channel !== "linkedin" && !person.email)) failures.push("no_channel");

  if (person && isSuppressed(db, person.email)) failures.push("recipient_suppressed");

  const priorInRequest = db.outreach.find(
    (o) => o.requestId === req.requestId && o.personId === req.personId && o.status !== "none",
  );
  if (PER_REQUESTER_ONCE && priorInRequest) failures.push("already_contacted");

  const cutoff = now.getTime() - GLOBAL_COOLDOWN_DAYS * 86_400_000;
  const recentElsewhere = db.sendAttempts.some(
    (a) =>
      a.personId === req.personId &&
      a.result === "allowed" &&
      a.requestId !== req.requestId &&
      new Date(a.at).getTime() > cutoff,
  );
  if (recentElsewhere) failures.push("recipient_cooldown");

  if (account && sentToday(db, account.id, now) >= account.dailyCap) {
    failures.push("daily_cap_reached");
  }

  if (account && balanceOf(db, account.id) < 1) failures.push("insufficient_credits");

  const mine = db.sendAttempts.filter((a) => a.accountId === req.accountId && a.result === "allowed");
  const hash = variantHash(req.body);
  if (mine.some((a) => a.variantHash === hash)) {
    failures.push("near_duplicate");
  } else {
    if (mine.some((a) => similarity(a.body, req.body) >= NEAR_DUPLICATE_THRESHOLD)) {
      failures.push("near_duplicate");
    }
  }

  return {
    allowed: failures.length === 0,
    failures,
    pool,
    variantHash: hash,
    reason: failures.length ? REASON[failures[0]] : undefined,
  };
}

export function gateReason(failure: GateFailure): string {
  return REASON[failure];
}
