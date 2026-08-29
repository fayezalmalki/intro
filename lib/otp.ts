import { createHash, randomInt } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { otpCodes } from "./db/schema";

/**
 * One-time sign-in codes, ported from careers.sa `convex/authEmailDb.ts` and
 * `convex/authEmail.ts`.
 *
 * Five rules, all of them here rather than spread across the route and the
 * provider, because a limiter that lives beside its caller is a limiter one
 * new caller can walk past:
 *
 *   1. **Hashed at rest.** The code is the entire credential for an address.
 *      A database dump, a replicated log line or a support screenshot that
 *      carried live codes would be account takeover for every address with one
 *      outstanding. sha256 with no salt is deliberate — the input space is a
 *      million six-digit strings, so a salt buys nothing an attacker with the
 *      table could not brute-force in a second; what it buys is that the rows
 *      are not *directly usable*, and the attempt limiter below is what makes
 *      guessing the live code hopeless.
 *   2. **Single use, latest only.** Issuing a code destroys the previous one,
 *      and verifying destroys the one it used.
 *   3. **≤ MAX_ATTEMPTS wrong guesses per code**, then the row is destroyed.
 *      Without this, a six-digit code is a million guesses against an endpoint
 *      with no counter — minutes of scripted traffic.
 *   4. **≤ MAX_SENDS_PER_WINDOW sends per window, plus a resend cooldown.**
 *      Both are derived from the table, not from process memory: serverless
 *      instances share no memory, so a counter would reset on every cold start
 *      and limit nothing.
 *   5. **Precheck → send → commit.** `sendGate` is read-only and consumes
 *      nothing; `replaceCode` runs only after SMTP has accepted the message. A
 *      failed send therefore stores no code and burns none of the user's
 *      budget — they can retry immediately, which is the correct behaviour
 *      when the fault is ours.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 8;

export const OTP_LIMITS = {
  ttlMs: CODE_TTL_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  sendWindowMs: SEND_WINDOW_MS,
  maxSendsPerWindow: MAX_SENDS_PER_WINDOW,
  maxAttempts: MAX_ATTEMPTS,
} as const;

/** crypto, not Math.random: the code is the whole credential. */
export function generateCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export type SendRefusal = "cooldown" | "too_many";

export interface SendGate {
  ok: boolean;
  reason?: SendRefusal;
  /** Seconds until a retry could succeed, for the response's Retry-After. */
  retryAfterSeconds?: number;
}

async function latestFor(
  email: string,
  database: Database,
): Promise<typeof otpCodes.$inferSelect | undefined> {
  const [row] = await database
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, email))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return row;
}

function evaluate(latest: typeof otpCodes.$inferSelect | undefined, now: number): SendGate {
  if (!latest) return { ok: true };

  const sinceLast = now - latest.createdAt.getTime();
  if (sinceLast < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000),
    };
  }

  const windowStart = latest.firstSentAt.getTime();
  const inWindow = now - windowStart < SEND_WINDOW_MS;
  if (inWindow && latest.sendCount >= MAX_SENDS_PER_WINDOW) {
    return {
      ok: false,
      reason: "too_many",
      retryAfterSeconds: Math.ceil((windowStart + SEND_WINDOW_MS - now) / 1000),
    };
  }
  return { ok: true };
}

/**
 * The read-only half of the rate limit, checked BEFORE the SMTP send.
 *
 * Consumes nothing on purpose. The counters only advance in `replaceCode`,
 * which callers run strictly after a confirmed handoff to the mail server.
 */
export async function sendGate(
  email: string,
  database: Database = defaultDb,
  now = Date.now(),
): Promise<SendGate> {
  return evaluate(await latestFor(email, database), now);
}

/**
 * Commits a freshly-sent code: destroys every earlier one for the address and
 * starts the cooldown.
 *
 * Re-runs the gate rather than trusting the precheck — two requests a
 * millisecond apart both pass a read-only check, and the latest-only rule plus
 * this second look mean the loser writes nothing instead of resetting the
 * winner's counters. Returns the gate verdict so the caller can tell the
 * difference between "sent" and "someone beat you to it".
 */
export async function replaceCode(
  email: string,
  codeHash: string,
  database: Database = defaultDb,
  now = Date.now(),
): Promise<SendGate> {
  return database.transaction(async (tx) => {
    const latest = await latestFor(email, tx as unknown as Database);
    const gate = evaluate(latest, now);
    if (!gate.ok) return gate;

    const windowStart = latest ? latest.firstSentAt.getTime() : now;
    const inWindow = Boolean(latest) && now - windowStart < SEND_WINDOW_MS;

    // Only the most recent code is ever valid.
    await tx.delete(otpCodes).where(eq(otpCodes.email, email));
    await tx.insert(otpCodes).values({
      email,
      codeHash,
      expiresAt: new Date(now + CODE_TTL_MS),
      attempts: 0,
      sendCount: inWindow ? (latest?.sendCount ?? 0) + 1 : 1,
      firstSentAt: new Date(inWindow ? windowStart : now),
      createdAt: new Date(now),
    });
    return { ok: true };
  });
}

export type VerifyFailure = "no_code" | "expired" | "too_many_attempts" | "wrong_code";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

/**
 * Verifies a code and consumes it.
 *
 * Compares hashes, never the code — nothing in this process ever holds the
 * plaintext of a stored code. A wrong guess costs an attempt; the eighth
 * destroys the row, so an attacker gets eight guesses at a million and then has
 * to pass the send limiter to get another eight.
 */
export async function consumeCode(
  email: string,
  code: string,
  database: Database = defaultDb,
  now = Date.now(),
): Promise<VerifyResult> {
  return database.transaction(async (tx) => {
    const row = await latestFor(email, tx as unknown as Database);
    if (!row) return { ok: false as const, reason: "no_code" as const };

    if (row.expiresAt.getTime() < now) {
      await tx.delete(otpCodes).where(eq(otpCodes.id, row.id));
      return { ok: false as const, reason: "expired" as const };
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      await tx.delete(otpCodes).where(eq(otpCodes.id, row.id));
      return { ok: false as const, reason: "too_many_attempts" as const };
    }

    if (row.codeHash !== hashCode(code)) {
      const attempts = row.attempts + 1;
      // The attempt that reaches the limit invalidates the code immediately,
      // rather than leaving a live row for the next request to reject.
      if (attempts >= MAX_ATTEMPTS) {
        await tx.delete(otpCodes).where(eq(otpCodes.id, row.id));
        return { ok: false as const, reason: "too_many_attempts" as const };
      }
      await tx.update(otpCodes).set({ attempts }).where(eq(otpCodes.id, row.id));
      return { ok: false as const, reason: "wrong_code" as const };
    }

    await tx.delete(otpCodes).where(eq(otpCodes.id, row.id));
    return { ok: true as const };
  });
}
