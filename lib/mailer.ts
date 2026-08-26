import nodemailer from "nodemailer";

/**
 * Pool 1 of the three sending pools in docs/03-design-review.md: mail to our
 * own users, and nothing else. Intro requests to third parties go out on a
 * separate domain with a separate provider, so a complaint on outreach can
 * never take login mail down with it.
 */
const FROM = "Intro <noreply@intro.sa>";

function transport() {
  if (!process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: "smtp.improvmx.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: "noreply@intro.sa", pass: process.env.SMTP_PASSWORD },
  });
}

/** In development without SMTP configured, the code is logged instead. */
async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const mail = transport();
  if (!mail) {
    console.log(`[mailer] ${subject} → ${to}\n${text}`);
    return;
  }
  await mail.sendMail({ from: FROM, to, subject, html, text });
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

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  await send(
    to,
    "رابط الدخول إلى Intro",
    layout(
      "رابط الدخول",
      `<p style="color:#686868;line-height:1.8">اضغط الزر لتسجيل الدخول. الرابط صالح لمرة واحدة.</p>
       <p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#4F6B4C;color:#fff;text-decoration:none;border-radius:7px;padding:11px 20px">ادخل إلى Intro</a></p>
       <p style="color:#A3A3A0;font-size:13px">إذا ما طلبت هذا الرابط، تجاهل هذا الإيميل.</p>`,
    ),
    `رابط الدخول إلى Intro: ${url}`,
  );
}
