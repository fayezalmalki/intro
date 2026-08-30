import nodemailer from "nodemailer";

/**
 * Pool 1 of the three sending pools in docs/sending-domains.md: mail to our
 * own users, and nothing else. Intro requests to third parties go out on a
 * separate domain with a separate provider, so a complaint on outreach can
 * never take login mail down with it.
 *
 * intro.sa is also connected to Resend, which is the better home for pool 1 —
 * it handles bounces and exposes complaint feedback, where ImprovMX is a
 * forwarding relay that reports almost nothing back. Moving the primary path
 * onto it is a change to this module alone: lib/otp.ts sits above the
 * transport and does not care which one is underneath. This SMTP path stays
 * either way, as the fallback.
 *
 * The transport half is ported from careers.sa `convex/email.ts`, which
 * learned all of it the hard way in production: nodemailer does not infer TLS
 * from the port, an unconfigured SMTP password is a silent no-op that looks
 * like a working login, and "send failed" with no class is an unactionable
 * page for whoever is on call.
 */

/** The mailbox we authenticate as. Its domain decides what we may say FROM. */
const DEFAULT_USER = "noreply@intro.sa";

/**
 * The hard rule from docs/sending-domains.md, enforced rather than written
 * down: intro.sa never authenticates as a careers.sa alias. ImprovMX relays
 * only for the authenticated alias's own domain, so pointing this at the
 * careers credential would send intro mail as careers.sa — and every bounce on
 * an address we guessed would land on the domain that carries careers.sa's own
 * OTP mail.
 */
const ALLOWED_SENDING_DOMAIN = "intro.sa";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** "Intro <noreply@intro.sa>" → "intro.sa" */
function domainOf(address: string): string {
  const match = address.match(/<([^>]+)>/);
  return (match ? match[1] : address).trim().split("@")[1]?.toLowerCase() ?? "";
}

export interface Sender {
  user: string;
  pass: string;
  from: string;
}

export class EmailNotConfiguredError extends Error {
  constructor(message = "SMTP_PASSWORD is not set — outbound email is disabled") {
    super(`EMAIL_NOT_CONFIGURED: ${message}`);
    this.name = "EmailNotConfiguredError";
  }
}

/**
 * The identity every message goes out as.
 *
 * The FROM is derived from the credential rather than configured beside it: a
 * FROM on a domain the credential does not own is rejected by the relay at
 * MAIL FROM time, which classifies as `from_rejected` and reads like a broken
 * mailbox rather than a mismatched pair.
 */
export function resolveSender(): Sender {
  const user = env("SMTP_USER") ?? DEFAULT_USER;
  const domain = domainOf(user);
  if (domain !== ALLOWED_SENDING_DOMAIN) {
    throw new EmailNotConfiguredError(
      `SMTP_USER is ${user}, which is not on ${ALLOWED_SENDING_DOMAIN}. ` +
        "intro.sa must never send on another product's domain — see docs/sending-domains.md.",
    );
  }
  const configuredFrom = env("SMTP_FROM");
  const from =
    configuredFrom && domainOf(configuredFrom) === domain ? configuredFrom : `Intro <${user}>`;
  return { user, pass: env("SMTP_PASSWORD") ?? "", from };
}

export function isEmailConfigured(): boolean {
  try {
    return Boolean(resolveSender().pass);
  } catch {
    return false;
  }
}

interface SmtpCandidate {
  port: number;
  secure: boolean;
}

/**
 * Which (port, TLS) pairs to try, in order.
 *
 * nodemailer does NOT infer TLS from the port: with `secure: false` against
 * 465 — which only speaks implicit TLS — the socket hangs until
 * connectionTimeout. On careers.sa that produced a `timeout` class on every
 * single send while host, alias and password were all correct. So `secure` is
 * inferred from the port (override with SMTP_SECURE), and the other standard
 * pair is kept as a fallback for networks where one of the two is blocked.
 */
export function smtpCandidates(): SmtpCandidate[] {
  const configured = Number.parseInt(env("SMTP_PORT") ?? "", 10);
  const explicitSecure = env("SMTP_SECURE");
  const secureFor = (port: number) => (explicitSecure ? explicitSecure === "true" : port === 465);

  const primary: SmtpCandidate = Number.isFinite(configured)
    ? { port: configured, secure: secureFor(configured) }
    : { port: 587, secure: false };
  const alternate: SmtpCandidate =
    primary.port === 465 ? { port: 587, secure: false } : { port: 465, secure: true };
  return [primary, alternate];
}

function transporter(candidate: SmtpCandidate, sender: Sender) {
  return nodemailer.createTransport({
    host: env("SMTP_HOST") ?? "smtp.improvmx.com",
    port: candidate.port,
    secure: candidate.secure,
    requireTLS: !candidate.secure,
    auth: { user: sender.user, pass: sender.pass },
    // Fail fast: a serverless invocation is killed long before nodemailer's
    // ~2-minute defaults, so a slow host would look like a crash rather than a
    // logged, classified send failure.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
}

/**
 * Only connection-class failures are worth retrying on the alternate port — a
 * rejected password or a rejected sender fails identically there, and retrying
 * one of those only doubles the time before the user is told.
 */
export function isConnectionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err?.code === "ETIMEDOUT" ||
    err?.code === "ESOCKET" ||
    err?.code === "ECONNECTION" ||
    err?.code === "ECONNREFUSED" ||
    /timeout|timed out/i.test(err?.message ?? "")
  );
}

export type SmtpErrorClass = "auth" | "from_rejected" | "timeout" | "not_configured" | "other";

/**
 * Classify an SMTP failure, so the message the user sees and the row in
 * `usageEvents` both say which of five different problems it was.
 *
 * ImprovMX specifics: EAUTH/535 is a bad alias or password; 550/553/554 on
 * MAIL FROM means the sender's domain is not the authenticated alias's domain,
 * because ImprovMX relays only for its own.
 */
export function classifySmtpError(error: unknown): SmtpErrorClass {
  const err = error as {
    name?: string;
    code?: string;
    responseCode?: number;
    message?: string;
  };
  if (err?.name === "EmailNotConfiguredError") return "not_configured";
  if (err?.code === "EAUTH" || err?.responseCode === 535) return "auth";
  if (
    err?.responseCode === 550 ||
    err?.responseCode === 553 ||
    err?.responseCode === 554 ||
    /mail from|not allowed to send|sender/i.test(err?.message ?? "")
  ) {
    return "from_rejected";
  }
  if (isConnectionError(error)) return "timeout";
  return "other";
}

/**
 * What the person staring at the login screen is told, per class.
 *
 * Distinct on purpose: "try again in a moment" is true for a timeout and a lie
 * for an unconfigured mailbox, and someone who retries a lie ten times has told
 * us nothing. None of these consume the resend cooldown — see lib/otp.ts.
 */
export const SMTP_FAILURE_MESSAGES: Record<SmtpErrorClass, string> = {
  auth: "تعذر إرسال الرمز — خلل في مصادقة خادم البريد عندنا. بلّغنا وجرّب بعد قليل.",
  from_rejected: "تعذر إرسال الرمز — خادم البريد رفض عنوان المرسل عندنا. بلّغنا وجرّب بعد قليل.",
  timeout: "خادم البريد بطيء حالياً — جرّب مرة ثانية خلال لحظات.",
  not_configured: "خدمة البريد غير مهيأة حالياً — ما نقدر نرسل رموز دخول. بلّغنا لنصلحها.",
  other: "تعذر إرسال الرمز — جرّب مرة ثانية، وإذا تكررت بلّغنا.",
};

/**
 * In development without SMTP configured, the message is logged instead — never
 * in production, and never as a fallback for a *failed* send. Callers that must
 * not silently succeed check `isEmailConfigured()` first (lib/otp.ts does), so
 * this branch is a local convenience and not a hole.
 */
async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const sender = resolveSender();
  if (!sender.pass) {
    if (process.env.NODE_ENV === "production") throw new EmailNotConfiguredError();
    console.log(`[mailer] ${subject} → ${to}\n${text}`);
    return;
  }

  const message = { from: sender.from, to, subject, html, text };
  const candidates = smtpCandidates();
  let lastError: unknown;
  for (const [index, candidate] of candidates.entries()) {
    try {
      await transporter(candidate, sender).sendMail(message);
      if (index > 0) {
        console.warn(
          `[mailer] sent on fallback port ${candidate.port} (secure=${candidate.secure}) — ` +
            "set SMTP_PORT to it so the first attempt stops burning a timeout.",
        );
      }
      return;
    } catch (error) {
      lastError = error;
      if (!isConnectionError(error)) throw error;
      console.warn(
        `[mailer] SMTP ${candidate.port} (secure=${candidate.secure}) unreachable — ` +
          (index < candidates.length - 1 ? "trying the alternate port." : "no candidates left."),
      );
    }
  }
  throw lastError;
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
       <p style="color:#A3A3A0;font-size:13px">لا تشارك هذا الرمز مع أحد — ولا أحد من Intro بيطلبه منك.</p>
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
