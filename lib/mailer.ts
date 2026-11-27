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

interface MailEnv { EMAIL?: SendEmail; IMPROVMX_SMTP_USER?: string; IMPROVMX_SMTP_PASSWORD?: string; OUTREACH_SMTP_USER?: string; OUTREACH_SMTP_PASSWORD?: string }

/**
 * ImprovMX SMTP (smtp.improvmx.com, implicit TLS on 465) when its credentials
 * are set — it can send to any recipient. Otherwise Cloudflare Email Service
 * (the EMAIL binding), which on the Workers Free plan only reaches verified
 * addresses. Without either (unit tests, local dev) the message is logged, so
 * the sign-in code is still visible.
 */
export function transportFor(e: MailEnv): "smtp" | "binding" | "log" {
  if (e.IMPROVMX_SMTP_USER && e.IMPROVMX_SMTP_PASSWORD) return "smtp";
  return e.EMAIL ? "binding" : "log";
}

type Kind = "otp" | "activation_requested" | "activated" | "credit_request" | "follow_up_digest" | "invite_back" | "outreach" | "admin_alert";

/** Where replies to app mail land: the intro.sa catch-all forwards to the team. */
const REPLY_TO = { name: "intro.sa", email: "hello@intro.sa" };

/** Records each attempt for the monitoring page; never lets logging break sending. */
async function record(kind: Kind, to: string, transport: "smtp" | "binding" | "log", error?: unknown): Promise<void> {
  try {
    const { logEmail } = await import("./db/repo");
    const e = error as { code?: string; message?: string } | undefined;
    await logEmail({ kind, to, transport, status: error ? "failed" : "sent", error: error ? `${e?.code ?? ""} ${e?.message ?? String(error)}`.trim().slice(0, 300) : undefined });
  } catch (err) {
    console.error("[mailer] could not record email", err);
  }
}

async function send(kind: Kind, to: string | string[], subject: string, html: string, text: string, replyTo?: { name: string; email: string }): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  const transport = transportFor(env as unknown as MailEnv);
  for (const recipient of recipients) {
    try {
      await deliver(recipient, subject, html, text, replyTo);
      await record(kind, recipient, transport);
    } catch (error) {
      await record(kind, recipient, transport, error);
      throw error;
    }
  }
}

async function deliver(to: string, subject: string, html: string, text: string, replyTo?: { name: string; email: string }): Promise<void> {
  const e = env as unknown as MailEnv;
  const recipients = [to];
  if (transportFor(e) === "smtp" && e.IMPROVMX_SMTP_USER && e.IMPROVMX_SMTP_PASSWORD) {
    const { WorkerMailer } = await import("worker-mailer");
    const from = e.IMPROVMX_SMTP_USER.includes("@") ? { name: FROM.name, email: e.IMPROVMX_SMTP_USER } : FROM;
    for (const recipient of recipients) {
      await WorkerMailer.send(
        { host: "smtp.improvmx.com", port: 465, secure: true, credentials: { username: e.IMPROVMX_SMTP_USER, password: e.IMPROVMX_SMTP_PASSWORD }, authType: ["plain", "login"] },
        { from, to: recipient, subject, html, text, ...(replyTo ? { reply: replyTo } : {}) },
      );
    }
    return;
  }
  const mail = e.EMAIL;
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
    "otp",
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
    "activation_requested",
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
    "activated",
      to,
      "You can send through intro.sa",
      layout(
        "ltr",
        `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">You're cleared to send, ${esc(name)}.</h1>
         <p style="color:#575B54;line-height:1.7;margin:0 0 22px">Your account is verified${credits ? ` and ${credits} credits are on it` : ""}. Open any lead and press "Send through intro" — it goes out as "you via intro", replies come to your inbox, up to 10 a day. Your own email keeps working too.</p>
         ${button(`${SITE}/leads?lang=en`, "Open my leads")}`,
      ),
      `You can now send through intro.sa. Open any lead and press "Send through intro". ${SITE}/leads`,
    );
    return;
  }
  await send(
    "activated",
    to,
    "تقدر ترسل عبر انترو",
    layout(
      "rtl",
      `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">أهلًا ${esc(name)}، صار تقدر ترسل.</h1>
       <p style="color:#575B54;line-height:1.8;margin:0 0 22px">تم توثيق حسابك${credits ? ` وأضفنا لك ${credits} رصيد` : ""}. افتح أي عميل واضغط «أرسلها عبر انترو»، وتطلع باسمك عبر انترو والردود توصل بريدك، بحد 10 رسائل يوميًا. وبريدك الشخصي يشتغل عادي.</p>
       ${button(`${SITE}/leads?lang=ar`, "افتح عملائي")}`,
    ),
    `تقدر الحين ترسل عبر انترو. افتح أي عميل واضغط «أرسلها عبر انترو». ${SITE}/leads`,
  );
}

/** To the admins: someone wants credits while card payments aren't set up. */
export async function sendCreditRequest(admins: string[], account: { displayName: string; email: string; company?: string }, pack: string): Promise<void> {
  if (admins.length === 0) return;
  await send(
    "credit_request",
    admins,
    `طلب رصيد: ${account.displayName} (${pack})`,
    layout("rtl", `<h1 style="font-size:20px;margin:0 0 10px;color:#141613">طلب شحن رصيد</h1>
      <p style="color:#575B54;line-height:1.8;margin:0 0 18px" dir="auto">${esc(account.displayName)} · ${esc(account.email)}${account.company ? ` · ${esc(account.company)}` : ""}<br>الباقة: ${esc(pack)}</p>
      ${button(`${SITE}/am/team`, "امنح الرصيد")}`),
    `طلب رصيد من ${account.displayName} <${account.email}> — ${pack}. ${SITE}/am/team`,
  );
}

/** The daily nudge: follow-ups that are due, each linking to its drafted message. */
export async function sendFollowUpDigest(
  to: string, name: string, locale: "ar" | "en", leads: { id: string; name: string; company: string; step: number }[],
): Promise<void> {
  const ar = locale !== "en";
  const step = (n: number) => (ar ? (n >= 2 ? "آخر رسالة" : "المتابعة الأولى") : n >= 2 ? "Last note" : "Follow-up 1");
  const rows = leads.slice(0, 10).map((l) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #EEEEEA"><a href="${SITE}/leads/${l.id}?lang=${ar ? "ar" : "en"}" style="color:#141613;text-decoration:none;font-weight:600">${esc(l.name)}</a><div style="color:#696D66;font-size:13px">${esc(l.company)} · ${step(l.step)}</div></td></tr>`).join("");
  const more = leads.length > 10 ? (ar ? `<p style="color:#696D66">و${leads.length - 10} غيرهم في التطبيق.</p>` : `<p style="color:#696D66">And ${leads.length - 10} more in the app.</p>`) : "";
  const subject = ar ? `${leads.length} متابعة جاهزة للإرسال` : `${leads.length} follow-up${leads.length === 1 ? "" : "s"} ready to send`;
  await send(
    "follow_up_digest",
    to,
    subject,
    layout(ar ? "rtl" : "ltr", ar
      ? `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">صباح الخير ${esc(name)}</h1>
         <p style="color:#575B54;line-height:1.8;margin:0 0 10px">كتبنا لك هذي المتابعات. افتح كل وحدة وأرسلها من بريدك.</p>
         <table style="width:100%;border-collapse:collapse">${rows}</table>${more}
         <div style="margin-top:20px">${button(`${SITE}/home?lang=ar`, "افتح متابعاتي")}</div>`
      : `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">Good morning, ${esc(name)}</h1>
         <p style="color:#575B54;line-height:1.7;margin:0 0 10px">These follow-ups are drafted and ready. Open each one and send it from your email.</p>
         <table style="width:100%;border-collapse:collapse">${rows}</table>${more}
         <div style="margin-top:20px">${button(`${SITE}/home?lang=en`, "Open my follow-ups")}</div>`),
    `${subject}\n${leads.map((l) => `- ${l.name} (${l.company}): ${SITE}/leads/${l.id}`).join("\n")}`,
  );
}

/**
 * To someone who asked for a sign-in code and never got in — sent by the team
 * from the sign-ups page, once. Both languages: we don't know which they read.
 */
export async function sendInviteBack(to: string): Promise<void> {
  const subject = "رمز الدخول جاهز الحين · Your intro.sa sign-in code works now";
  await send(
    "invite_back",
    to,
    subject,
    layout("rtl", `<h1 style="font-size:20px;margin:0 0 8px;color:#141613">رمز الدخول ما وصلك؟ انحلّت المشكلة</h1>
       <p style="color:#575B54;line-height:1.8;margin:0 0 18px">حاولت تدخل انترو وما وصلك رمز الدخول. كان عندنا خلل في إرسال الرموز وانحلّ الحين. ادخل مرة ثانية ويوصلك رمز جديد خلال ثواني. نعتذر عن الإزعاج.</p>
       ${button(`${SITE}/login?lang=ar`, "ادخل انترو")}
       <div dir="ltr" style="border-top:1px solid #EEEEEA;margin-top:24px;padding-top:18px;text-align:left">
         <p style="color:#575B54;line-height:1.7;margin:0 0 14px">You tried to sign in to intro.sa and your code never arrived. We had a problem sending codes — it's fixed now. Sign in again and a new code arrives within seconds. Sorry about that.</p>
         ${button(`${SITE}/login?lang=en`, "Sign in to intro.sa")}
       </div>
       <p style="color:#8A8D86;font-size:13px;margin:22px 0 0">فريق انترو · The intro.sa team — رد على هالإيميل إذا احتجت شي · just reply if you need anything.</p>`),
    `رمز الدخول ما وصلك؟ انحلّت المشكلة. ادخل مرة ثانية: ${SITE}/login?lang=ar\n\nYour sign-in code never arrived — it's fixed now. Sign in again: ${SITE}/login?lang=en\n\nThe intro.sa team`,
    REPLY_TO,
  );
}

/**
 * Outreach a user sends through intro. A separate sending domain
 * (reach.intro.sa) and login, so outreach reputation can never touch sign-in
 * mail on intro.sa. "<Name> via intro" as the sender, replies to the user's
 * own address, a one-click opt-out (RFC 8058) and an honest footer.
 */
export function outreachConfigured(): boolean {
  const e = env as unknown as MailEnv;
  return Boolean(e.OUTREACH_SMTP_USER && e.OUTREACH_SMTP_PASSWORD);
}

export async function sendOutreach(input: {
  to: string; subject: string; body: string; senderName: string; senderCompany?: string; replyTo: string; optOutUrl: string; lang: "ar" | "en";
}): Promise<void> {
  const e = env as unknown as MailEnv;
  if (!e.OUTREACH_SMTP_USER || !e.OUTREACH_SMTP_PASSWORD) throw new Error("outreach_not_configured");
  const who = input.senderCompany ? `${input.senderName} (${input.senderCompany})` : input.senderName;
  const footerText = input.lang === "ar"
    ? `أرسلها ${who} عبر intro.sa. ما تبي رسائل منه؟ ${input.optOutUrl}`
    : `Sent by ${who} via intro.sa. Don't want messages like this? ${input.optOutUrl}`;
  const body = esc(input.body).replace(/\n/g, "<br>");
  const html = `<div dir="${input.lang === "ar" ? "rtl" : "ltr"}" style="font-family:-apple-system,'Segoe UI','IBM Plex Sans Arabic',Tahoma,sans-serif;font-size:15px;line-height:1.7;color:#141613">${body}
    <p style="margin-top:28px;color:#8A8D86;font-size:12px">${esc(footerText.replace(input.optOutUrl, "")).trim()} <a href="${input.optOutUrl}" style="color:#8A8D86">${input.lang === "ar" ? "إلغاء الاشتراك" : "Opt out"}</a></p></div>`;
  const { WorkerMailer } = await import("worker-mailer");
  try {
    await WorkerMailer.send(
      { host: "smtp.improvmx.com", port: 465, secure: true, credentials: { username: e.OUTREACH_SMTP_USER, password: e.OUTREACH_SMTP_PASSWORD }, authType: ["plain", "login"] },
      {
        from: { name: `${input.senderName} via intro`, email: e.OUTREACH_SMTP_USER },
        to: input.to,
        reply: input.replyTo,
        subject: input.subject,
        text: `${input.body}\n\n—\n${footerText}`,
        html,
        headers: {
          "List-Unsubscribe": `<${input.optOutUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
    );
    await record("outreach", input.to, "smtp");
  } catch (error) {
    await record("outreach", input.to, "smtp", error);
    throw error;
  }
}

/** To admins: what went wrong in the last day (lib/alerts.ts). */
export async function sendAdminAlert(admins: string[], lines: string[], details: string[]): Promise<void> {
  const list = lines.map((l) => `<li style="margin:4px 0">${esc(l)}</li>`).join("");
  const more = details.length ? `<p style="color:#575B54;margin:16px 0 6px">Latest errors:</p><pre style="white-space:pre-wrap;font-size:12px;background:#F4F4F1;padding:10px;border-radius:8px">${esc(details.join("\n"))}</pre>` : "";
  await send(
    "admin_alert",
    admins,
    `intro.sa needs a look: ${lines[0]}`,
    layout("ltr", `<h1 style="font-size:19px;margin:0 0 10px;color:#141613">In the last 24 hours</h1><ul style="padding-left:18px;color:#141613;line-height:1.6">${list}</ul>${more}
      <div style="margin-top:18px">${button(`${SITE}/am/metrics`, "Open the dashboard")}</div>`),
    `In the last 24 hours:\n- ${lines.join("\n- ")}\n\n${details.join("\n")}\n\n${SITE}/am/metrics`,
  );
}
