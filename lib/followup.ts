import type { Account } from "./types";

/**
 * The follow-up sequence. After the first message, one nudge on day 3 and a
 * short, polite last note on day 7 — then we stop and suggest moving on.
 * Sending happens from the person's own email; this only drafts and reminds.
 */
export const FOLLOW_UP_DAYS = [3, 7] as const;

/** When the next follow-up is due after sending message number `sent` (0 = the first message). */
export function nextFollowUp(sent: number, from = new Date()): string | null {
  const day = FOLLOW_UP_DAYS[sent];
  if (day === undefined) return null;
  const prev = sent === 0 ? 0 : FOLLOW_UP_DAYS[sent - 1];
  return new Date(from.getTime() + (day - prev) * 86_400_000).toISOString();
}

export function followUpFor(input: { lang: "ar" | "en"; name: string; company: string; step: 1 | 2; me: Account }): string {
  const first = input.name.split(/\s+/)[0];
  const me = input.me.displayName;
  if (input.lang === "en") {
    return input.step === 1
      ? `Hi ${first},\n\nFollowing up on my note from earlier this week. If this isn't on your plate, who at ${input.company} would be the right person to talk to?\n\nThanks,\n${me}`
      : `Hi ${first},\n\nI don't want to crowd your inbox, so this is my last note. If the timing changes, I'd be glad to pick this up — just reply to this email.\n\nAll the best,\n${me}`;
  }
  return input.step === 1
    ? `هلا ${first}،\n\nأتابع رسالتي اللي أرسلتها بداية الأسبوع. إذا الموضوع مو من اختصاصك، مين الشخص المناسب في ${input.company} أتواصل معه؟\n\nشكرًا لك،\n${me}`
    : `هلا ${first}،\n\nما أبي أثقل عليك، فهذي آخر رسالة مني. إذا تغيّر التوقيت، يسعدني نكمل، بس رد على هالإيميل.\n\nكل التوفيق،\n${me}`;
}
