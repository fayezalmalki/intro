import { NEAR_DUPLICATE_THRESHOLD, similarity } from "./gate";

/**
 * Sending through intro (send.intro.sa) — the checks that protect the domain.
 *
 * Users can always send from their own email; sending through intro is earned
 * and bounded. Every check here runs before a message reaches the provider,
 * and every refusal is recorded. Pure: the context is loaded by
 * repo.outboundContext so this is tested without a database.
 */

/** A recipient contacted through intro by anyone is off-limits to others for this long. */
export const RECIPIENT_COOLDOWN_DAYS = 90;
/** All of intro's outreach in one day — the domain's warm-up ceiling. Raise as reputation builds. */
export const PLATFORM_DAILY_CAP = 150;
/** More links than this reads as marketing, not a note. */
const MAX_LINKS = 2;
const MIN_BODY = 60;

export type OutboundFailure =
  | "not_eligible" | "paused" | "unverified_email" | "suppressed" | "recipient_cooldown"
  | "sequence_done" | "daily_cap" | "platform_cap" | "near_duplicate" | "too_short" | "too_many_links" | "not_configured";

export interface OutboundContext {
  eligible: boolean;
  paused: boolean;
  configured: boolean;
  emailStatus: string | null;
  suppressed: boolean;
  /** Someone else sent to this address through intro within the cooldown. */
  contactedByOthers: boolean;
  /** 0 first message, 1 follow-up, 2 last note; 3+ = the sequence is over. */
  step: number;
  sentToday: number;
  dailyCap: number;
  platformSentToday: number;
  /** This account's recent first messages, for the near-duplicate check. */
  recentFirstBodies: string[];
}

export function checkOutbound(ctx: OutboundContext, body: string): OutboundFailure[] {
  const f: OutboundFailure[] = [];
  if (!ctx.configured) f.push("not_configured");
  if (!ctx.eligible) f.push("not_eligible");
  if (ctx.paused) f.push("paused");
  if (ctx.emailStatus !== "valid") f.push("unverified_email");
  if (ctx.suppressed) f.push("suppressed");
  if (ctx.contactedByOthers) f.push("recipient_cooldown");
  if (ctx.step > 2) f.push("sequence_done");
  if (ctx.sentToday >= ctx.dailyCap) f.push("daily_cap");
  if (ctx.platformSentToday >= PLATFORM_DAILY_CAP) f.push("platform_cap");
  if (body.trim().length < MIN_BODY) f.push("too_short");
  if ((body.match(/https?:\/\//g) ?? []).length > MAX_LINKS) f.push("too_many_links");
  // Follow-ups are short templates by design; the near-duplicate check is for first messages.
  if (ctx.step === 0 && ctx.recentFirstBodies.some((b) => similarity(b, body) >= NEAR_DUPLICATE_THRESHOLD)) f.push("near_duplicate");
  return f;
}

export const OUTBOUND_REASON: Record<OutboundFailure, { en: string; ar: string }> = {
  not_configured: { en: "Sending through intro isn't switched on yet. Use your own email for now.", ar: "الإرسال عبر انترو غير مفعّل بعد. استخدم بريدك حاليًا." },
  not_eligible: { en: "Verify your account to send through intro — or send from your own email.", ar: "وثّق حسابك عشان ترسل عبر انترو، أو أرسل من بريدك." },
  paused: { en: "Sending through intro is paused on your account after delivery problems. Your own email still works.", ar: "أوقفنا الإرسال عبر انترو في حسابك مؤقتًا بسبب مشاكل توصيل. بريدك الشخصي يشتغل عادي." },
  unverified_email: { en: "We only send to verified addresses. Reveal a verified email first.", ar: "نرسل للبريد الموثّق فقط. اكشف بريدًا موثّقًا أول." },
  suppressed: { en: "This person asked not to be contacted.", ar: "هذا الشخص طلب عدم التواصل معه." },
  recipient_cooldown: { en: "Someone reached this person through intro recently. Use your own email, or try later.", ar: "أحد تواصل مع هذا الشخص عبر انترو مؤخرًا. استخدم بريدك أو جرّب لاحقًا." },
  sequence_done: { en: "You've sent the first message and two follow-ups. That's the limit.", ar: "أرسلت الرسالة الأولى ومتابعتين، وهذا الحد." },
  daily_cap: { en: "You've reached today's limit for sending through intro. More tomorrow.", ar: "وصلت حد اليوم للإرسال عبر انترو. كمّل بكرة." },
  platform_cap: { en: "intro has reached today's sending limit. Use your own email, or send tomorrow.", ar: "انترو وصل حد الإرسال اليومي. استخدم بريدك أو أرسل بكرة." },
  near_duplicate: { en: "This is too close to a message you already sent. Make it about this person.", ar: "الرسالة قريبة جدًا من رسالة أرسلتها. خلّها تخص هذا الشخص." },
  too_short: { en: "This message is too short to send.", ar: "الرسالة قصيرة جدًا." },
  too_many_links: { en: "Too many links — keep it to two at most.", ar: "روابط كثيرة. خلها رابطين بالكثير." },
};

/** Personal mail providers: a work email on one of these can't vouch for a company. */
const FREEMAIL = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "msn.com", "yandex.com", "mail.com", "gmx.com"]);

/**
 * A work email at the company's own domain vouches for the person: such
 * accounts can send through intro without waiting for review.
 */
export function workEmailMatchesCompany(email: string, website?: string | null): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || FREEMAIL.has(domain) || !website) return false;
  const site = website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  return domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`);
}
