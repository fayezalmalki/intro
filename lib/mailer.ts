import { env } from "cloudflare:workers";

/**
 * Pool 1 of the three sending pools in docs/03-design-review.md: mail to our
 * own users, and nothing else. Outreach to third parties goes out on a
 * separate sending domain, so a complaint on outreach can never take login
 * mail down with it.
 *
 * Sent through Cloudflare Email Service (the EMAIL send_email binding).
 */
const FROM = { name: "Intro", email: "noreply@intro.sa" };

/**
 * Without the binding (unit tests, or local dev with email disabled) the
 * message is logged instead, so the sign-in code is still visible.
 */
async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const mail = (env as unknown as { EMAIL?: SendEmail }).EMAIL;
  if (!mail) {
    console.log(`[mailer] ${subject} → ${to}\n${text}`);
    return;
  }
  await mail.send({ from: FROM, to, subject, html, text });
}

function layout(heading: string, body: string): string {
  return `<div dir="rtl" style="font-family:system-ui,sans-serif;background:#F7F7F4;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #DEDED7;border-radius:10px;padding:28px">
    <div style="font-size:19px;font-weight:600;letter-spacing:-0.02em;margin-bottom:20px">intro<span style="color:#4F6B4C">.</span></div>
    <h1 style="font-size:19px;margin:0 0 12px">${heading}</h1>
    ${body}
  </div>
</div>`;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await send(
    to,
    `${code} — رمز الدخول إلى Intro`,
    layout(
      "رمز الدخول",
      `<p style="color:#686868;line-height:1.8">أدخل هذا الرمز لإكمال تسجيل الدخول. صالح لعشر دقائق.</p>
       <div style="font-size:30px;font-weight:600;letter-spacing:6px;direction:ltr;text-align:center;background:#F7F7F4;border:1px solid #DEDED7;border-radius:8px;padding:16px;margin:20px 0">${code}</div>
       <p style="color:#A3A3A0;font-size:13px">إذا ما طلبت هذا الرمز، تجاهل هذا الإيميل.</p>`,
    ),
    `رمز الدخول إلى Intro: ${code}\nصالح لعشر دقائق.`,
  );
}
