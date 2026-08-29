import { NextResponse } from "next/server";
import { generateCode, hashCode, OTP_LIMITS, replaceCode, sendGate } from "@/lib/otp";
import {
  classifySmtpError,
  isEmailConfigured,
  sendOtpEmail,
  SMTP_FAILURE_MESSAGES,
} from "@/lib/mailer";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";

const TTL_MINUTES = OTP_LIMITS.ttlMs / 60_000;

/**
 * Issues a sign-in code.
 *
 * Order of operations is the whole point, and it is the order careers.sa
 * arrived at after an incident: **precheck → send → commit**. The rate limit is
 * checked read-only, the mail server is asked to take the message, and only a
 * confirmed handoff writes the code row and advances the cooldown. A failed
 * send therefore stores nothing and consumes nothing — the user retries
 * immediately, because the fault was ours.
 *
 * The code never leaves the server except inside the email. There is no
 * on-screen fallback for an unconfigured or failing mailer: that is precisely
 * what the careers.sa incident was — an OTP printed to the browser because SMTP
 * was quietly not configured in production.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = String(body.email ?? "").toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // 254 is the maximum length of an address; anything longer is not a typo.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // 1. Read-only rate-limit precheck. Consumes nothing.
  const gate = await sendGate(email);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: gate.reason === "too_many" ? "too_many" : "too_soon",
        retryAfter: gate.retryAfterSeconds,
      },
      { status: 429, headers: { "retry-after": String(gate.retryAfterSeconds ?? 60) } },
    );
  }

  // Refuse loudly rather than pretending. An unconfigured mailer that returns
  // `ok` is a login screen asking for a code nobody will ever receive.
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    console.error("[send-otp] SMTP is not configured — refusing to issue a code");
    await logUsage({ kind: "otp_send_failed", email, meta: { class: "not_configured" } });
    return NextResponse.json(
      { error: "send_failed", message: SMTP_FAILURE_MESSAGES.not_configured },
      { status: 503 },
    );
  }

  const code = generateCode();

  // 2. Send FIRST.
  try {
    await sendOtpEmail(email, code);
  } catch (error) {
    const failureClass = classifySmtpError(error);
    const err = error as { code?: string; responseCode?: number };
    console.error(`[send-otp] OTP send failed (${failureClass})`, error);
    await logUsage({
      kind: "otp_send_failed",
      email,
      meta: {
        class: failureClass,
        code: err?.code ?? null,
        responseCode: err?.responseCode ?? null,
      },
    });
    return NextResponse.json(
      { error: "send_failed", message: SMTP_FAILURE_MESSAGES[failureClass] },
      { status: 502 },
    );
  }

  // 3. Confirmed handoff → store the hash, start the cooldown.
  const committed = await replaceCode(email, hashCode(code));
  await logUsage({ kind: "otp_sent", email });

  // A same-millisecond double request can pass both prechecks; the loser's
  // commit is refused and its code is simply never valid. Nothing to report —
  // the winner's code is in the same inbox.
  if (!committed.ok) console.warn(`[send-otp] concurrent request for ${email}; code discarded`);

  // Never echo the code, and never reveal whether the address has an account:
  // the response is identical either way.
  return NextResponse.json({ ok: true, expiresInMinutes: TTL_MINUTES });
}
