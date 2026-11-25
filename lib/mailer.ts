import { env } from "cloudflare:workers";

/**
 * Pool 1 of the three sending pools in docs/03-design-review.md: mail to our
 * own users, and nothing else. Outreach to third parties goes out on a
 * separate sending domain, so a complaint on outreach can never take login
 * mail down with it.
 *
 * Sent through Cloudflare Email Service (the EMAIL send_email binding).
 */
const FROM = { name: "intro.sa", email: "noreply@intro.sa" };
const SITE = "https://intro.sa";

/**
 * Without the binding (unit tests, or local dev with email disabled) the
 * message is logged instead, so the sign-in code is still visible.
 */
async function send(to: string | string[], subject: string, html: string, text: string): Promise<void> {
  const mail = (env as unknown as { EMAIL?: SendEmail }).EMAIL;
  const recipients = Array.isArray(to) ? to : [to];
  if (!mail) {
    console.log(`[mailer] ${subject} → ${recipients.join(", ")}\n${text}`);
    return;
  }
  for (const recipient of recipients) {
    await mail.send({ from: FROM, to: recipient, subject, html, text });
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The brand frame: the red/green mark, the green wordmark, a white card. */
function layout(dir: "rtl" | "ltr", body: string): string {
  return `<div dir="${dir}" style="font-family:-apple-system,'Segoe UI','IBM Plex Sans Arabic',Tahoma,sans-serif;background:#F4F4F1;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E5E6E0;border-radius:16px;padding:28px">
    <div dir="ltr" style="font-size:20px;font-weight:600;letter-spacing:-0.03em;color:#1D3D33;margin-bottom:22px">
      <span style="color:#C8432B">&#10077;</span><span style="color:#1D3D33">&#10078;</span> intro.sa
    </div>
    ${body}
  </div>
  <p style="text-align:center;color:#8A8D86;font-size:12px;margin-top:16px">intro.sa · Riyadh</p>
</div>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1D3D33;color:#fff;text-decoration:none;border-radius:999px;padding:12px 22px;font-weight:500">${label}</a>`;

/** Sign-in code. Better Auth hands us only the address, so it carries both languages. */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await send(
    to,
    `${code} — رمز الدخول إلى intro.sa · your sign-in code`,
    layout(
      "rtl",
      `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">رمز الدخول</h1>
       <p style="color:#575B54;line-height:1.8;margin:0">أدخل الرمز لإكمال تسجيل الدخول. صالح لمدة ١٠ دقائق.</p>
       <div dir="ltr" style="font-size:32px;font-weight:600;letter-spacing:8px;text-align:center;background:#F4F4F1;border-radius:12px;padding:18px;margin:22px 0;color:#141613">${code}</div>
       <p dir="ltr" style="color:#575B54;line-height:1.6;text-align:left;margin:0">Enter this code to finish signing in. It expires in 10 minutes.</p>
       <p style="color:#8A8D86;font-size:13px;margin:18px 0 0">إذا ما طلبت هذا الرمز، تجاهل الرسالة. · If you didn't ask for it, ignore this email.</p>`,
    ),
    `رمز الدخول إلى intro.sa: ${code} (صالح ١٠ دقائق)\nYour intro.sa sign-in code: ${code} (expires in 10 minutes)`,
  );
}

/** To the admins: someone is waiting to be allowed to send. */
export async function sendActivationRequested(
  admins: string[],
  account: { displayName: string; email: string; company?: string; companyWebsite?: string; linkedinUrl?: string; jobTitle?: string; note?: string },
): Promise<void> {
  if (admins.length === 0) return;
  const rows = [
    ["الاسم", account.displayName],
    ["البريد", account.email],
    ["الشركة", [account.company, account.companyWebsite].filter(Boolean).join(" · ")],
    ["المسمى", account.jobTitle ?? ""],
    ["LinkedIn", account.linkedinUrl ?? ""],
    ["ملاحظة", account.note ?? ""],
  ].filter(([, v]) => v);
  await send(
    admins,
    `طلب تفعيل إرسال: ${account.displayName}`,
    layout(
      "rtl",
      `<h1 style="font-size:20px;margin:0 0 14px;color:#141613">طلب تفعيل إرسال جديد</h1>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:22px">
         ${rows.map(([k, v]) => `<tr><td style="color:#8A8D86;padding:6px 0;width:90px">${k}</td><td style="color:#141613;padding:6px 0" dir="auto">${esc(v!)}</td></tr>`).join("")}
       </table>
       ${button(`${SITE}/am/team`, "راجع الطلب")}`,
    ),
    `طلب تفعيل إرسال: ${account.displayName} <${account.email}>\n${SITE}/am/team`,
  );
}

/** To the user: their account can send now. */
export async function sendActivated(to: string, name: string, locale: "ar" | "en", credits: number): Promise<void> {
  if (locale === "en") {
    await send(
      to,
      "You're cleared to send on intro.sa",
      layout(
        "ltr",
        `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">You're cleared to send, ${esc(name)}.</h1>
         <p style="color:#575B54;line-height:1.7;margin:0 0 22px">Your account is verified and ${credits} credits are on it. Approve your first emails from any published list — up to 10 a day.</p>
         ${button(`${SITE}/requests`, "Open my requests")}`,
      ),
      `You're cleared to send on intro.sa. ${credits} credits added. ${SITE}/requests`,
    );
    return;
  }
  await send(
    to,
    "تم تفعيل الإرسال في intro.sa",
    layout(
      "rtl",
      `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">أهلًا ${esc(name)}، صار تقدر ترسل.</h1>
       <p style="color:#575B54;line-height:1.8;margin:0 0 22px">تم توثيق حسابك وأضفنا لك ${credits} رصيد. وافق على أول رسائلك من أي قائمة منشورة، بحد أقصى ١٠ رسائل يوميًا.</p>
       ${button(`${SITE}/requests`, "افتح طلباتي")}`,
    ),
    `تم تفعيل الإرسال في intro.sa وأضفنا ${credits} رصيد. ${SITE}/requests`,
  );
}
