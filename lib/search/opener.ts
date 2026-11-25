import type { Account } from "../types";

/**
 * A first message for a saved lead, in the account's language, shaped by what
 * they told us at onboarding (their goal) and the lead's latest news. A draft
 * to edit, not a send: it opens in the user's own email.
 */
export function openerFor(input: { lang: "ar" | "en"; name: string; company: string; signal?: string; me: Account }): string {
  const first = input.name.split(/\s+/)[0];
  const me = input.me.displayName;
  const mine = input.me.company ? ` (${input.me.company})` : "";
  const goal = input.me.useCase ?? "sell";
  if (input.lang === "en") {
    const hook = input.signal ? `I saw "${input.signal}" — ` : `I've been following ${input.company} — `;
    const ask: Record<string, string> = {
      sell: `we help teams like yours with exactly this, and I think there's a fit. Worth 20 minutes next week?`,
      hire: `I'm building a team where your experience would matter, and I'd value a short conversation — no pressure.`,
      partner: `I think there's a clear partnership between us, and I have one concrete use case to share. Open to a quick call?`,
      "enter-market": `we're starting in Saudi and ${input.company} is exactly who we'd like to learn from. Could I take 20 minutes of your time?`,
      "hire-me": `your team's direction is exactly where I want to contribute next. Would you be open to a short chat?`,
      invest: `we're raising and our thesis lines up with yours. May I send a one-pager?`,
    };
    return `Hi ${first},\n\n${hook}${ask[goal] ?? ask.sell}\n\nBest,\n${me}${mine}`;
  }
  const hook = input.signal ? `شفت «${input.signal}»، ` : `أتابع اللي تسوونه في ${input.company}، `;
  const ask: Record<string, string> = {
    sell: "ونساعد فرقًا مثل فريقكم في هذا تحديدًا، وأتوقع فيه توافق واضح. يناسبك ٢٠ دقيقة الأسبوع الجاي؟",
    hire: "وأبني فريقًا تفرق فيه خبرتك، ويسعدني نتكلم شوي بدون أي التزام.",
    partner: "وأشوف فيه فرصة شراكة واضحة بيننا، وعندي حالة استخدام محددة أحب أعرضها. يناسبك اتصال سريع؟",
    "enter-market": `ونبدأ في السوق السعودي، و${input.company} من أكثر الجهات اللي نحب نتعلم منها. ممكن ٢٠ دقيقة من وقتك؟`,
    "hire-me": "واتجاه فريقكم هو بالضبط المكان اللي أبي أضيف فيه خطوتي الجاية. تسمح لي بحديث قصير؟",
    invest: "ونجمع جولة استثمارية وتوجهنا قريب من توجهكم. أقدر أرسل لك ملخصًا من صفحة وحدة؟",
  };
  return `هلا ${first}،\n\n${hook}${ask[goal] ?? ask.sell}\n\nتحياتي،\n${me}${mine}`;
}
