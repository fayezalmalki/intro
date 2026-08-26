import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { otpCodes } from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const TTL_MINUTES = 10;

/**
 * How long a caller must wait before a second code for the same address. This
 * is the rate limit, and it is deliberately derived from the codes table rather
 * than an in-memory counter: serverless instances do not share memory, so a
 * counter would reset on every cold start and rate-limit nothing.
 */
const RESEND_SECONDS = 60;

function sixDigits(): string {
  // crypto, not Math.random: the code is the whole credential.
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

export async function POST(request: Request): Promise<NextResponse> {
  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = String(body.email ?? "").toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const [recent] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        gt(otpCodes.expiresAt, new Date(Date.now() + (TTL_MINUTES * 60 - RESEND_SECONDS) * 1000)),
      ),
    )
    .limit(1);
  if (recent) {
    return NextResponse.json({ error: "too_soon", retryAfter: RESEND_SECONDS }, { status: 429 });
  }

  // Supersede any outstanding code, so an address never has two live codes.
  await db.delete(otpCodes).where(eq(otpCodes.email, email));

  const code = sixDigits();
  await db.insert(otpCodes).values({
    email,
    code,
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
  });

  await sendOtpEmail(email, code);

  // Never echo the code, and never reveal whether the address has an account:
  // the response is identical either way.
  return NextResponse.json({ ok: true, expiresInMinutes: TTL_MINUTES });
}
