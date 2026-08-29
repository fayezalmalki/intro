import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import { otpCodes } from "../db/schema";
import {
  consumeCode,
  generateCode,
  hashCode,
  OTP_LIMITS,
  replaceCode,
  sendGate,
} from "../otp";
import type { Database } from "../db";

/**
 * The four properties the OTP hardening exists for. Each one of them was a
 * real hole in this repo a commit ago: codes were stored in plaintext and
 * compared raw, a wrong code could be guessed forever, a failed send still
 * burned the user's cooldown, and there was no send budget at all.
 */
describe("one-time codes", () => {
  let db: Database;
  const email = "f@x.sa";

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  const row = async () => (await db.select().from(otpCodes).where(eq(otpCodes.email, email)))[0];

  describe("hashed at rest", () => {
    it("stores a sha256 of the code and never the code", async () => {
      const code = generateCode();
      await replaceCode(email, hashCode(code), db);

      const stored = await row();
      expect(stored.codeHash).toBe(createHash("sha256").update(code).digest("hex"));
      expect(stored.codeHash).not.toBe(code);
      // Nothing anywhere in the row is the code itself.
      expect(JSON.stringify(stored)).not.toContain(code);
    });

    it("verifies by hash, so the plaintext is never needed again", async () => {
      const code = "123456";
      await replaceCode(email, hashCode(code), db);

      expect(await consumeCode(email, "654321", db)).toEqual({ ok: false, reason: "wrong_code" });
      expect(await consumeCode(email, code, db)).toEqual({ ok: true });
    });

    it("consumes the code — one use, then it is gone", async () => {
      await replaceCode(email, hashCode("123456"), db);
      expect(await consumeCode(email, "123456", db)).toEqual({ ok: true });
      expect(await consumeCode(email, "123456", db)).toEqual({ ok: false, reason: "no_code" });
    });

    it("keeps only the latest code for an address", async () => {
      const now = Date.now();
      await replaceCode(email, hashCode("111111"), db, now);
      await replaceCode(email, hashCode("222222"), db, now + OTP_LIMITS.resendCooldownMs + 1);

      expect(await db.select().from(otpCodes).where(eq(otpCodes.email, email))).toHaveLength(1);
      expect(await consumeCode(email, "111111", db)).toEqual({ ok: false, reason: "wrong_code" });
    });

    it("refuses an expired code and clears it", async () => {
      const now = Date.now();
      await replaceCode(email, hashCode("123456"), db, now);
      const verdict = await consumeCode(email, "123456", db, now + OTP_LIMITS.ttlMs + 1);
      expect(verdict).toEqual({ ok: false, reason: "expired" });
      expect(await row()).toBeUndefined();
    });
  });

  describe("attempt limiter", () => {
    /**
     * Without this a six-digit code is a million guesses against an endpoint
     * that counts nothing — minutes of scripted traffic.
     */
    it("invalidates the code after the attempt limit and refuses the right code after", async () => {
      await replaceCode(email, hashCode("123456"), db);

      for (let i = 1; i < OTP_LIMITS.maxAttempts; i++) {
        expect(await consumeCode(email, "000000", db)).toEqual({ ok: false, reason: "wrong_code" });
        expect((await row()).attempts).toBe(i);
      }

      // The attempt that reaches the limit destroys the row rather than leaving
      // a live code for the next request to reject.
      expect(await consumeCode(email, "000000", db)).toEqual({
        ok: false,
        reason: "too_many_attempts",
      });
      expect(await row()).toBeUndefined();
      expect(await consumeCode(email, "123456", db)).toEqual({ ok: false, reason: "no_code" });
    });

    it("resets the counter for a newly issued code", async () => {
      const now = Date.now();
      await replaceCode(email, hashCode("111111"), db, now);
      await consumeCode(email, "000000", db, now);
      expect((await row()).attempts).toBe(1);

      await replaceCode(email, hashCode("222222"), db, now + OTP_LIMITS.resendCooldownMs + 1);
      expect((await row()).attempts).toBe(0);
    });
  });

  describe("send budget", () => {
    const cooled = (n: number) => Date.now() + n * (OTP_LIMITS.resendCooldownMs + 1);

    it("refuses a resend inside the cooldown, and says how long to wait", async () => {
      const now = Date.now();
      await replaceCode(email, hashCode("111111"), db, now);

      const gate = await sendGate(email, db, now + 10_000);
      expect(gate.ok).toBe(false);
      expect(gate.reason).toBe("cooldown");
      expect(gate.retryAfterSeconds).toBe(50);
    });

    it("allows the resend once the cooldown is over", async () => {
      const now = Date.now();
      await replaceCode(email, hashCode("111111"), db, now);
      expect((await sendGate(email, db, cooled(1))).ok).toBe(true);
    });

    it("stops at the send limit inside the window", async () => {
      for (let i = 0; i < OTP_LIMITS.maxSendsPerWindow; i++) {
        const at = cooled(i);
        expect((await sendGate(email, db, at)).ok).toBe(true);
        expect((await replaceCode(email, hashCode(`00000${i}`), db, at)).ok).toBe(true);
      }
      expect((await row()).sendCount).toBe(OTP_LIMITS.maxSendsPerWindow);

      const gate = await sendGate(email, db, cooled(OTP_LIMITS.maxSendsPerWindow));
      expect(gate).toMatchObject({ ok: false, reason: "too_many" });

      // And the commit refuses too — the precheck is a courtesy, not the lock.
      const commit = await replaceCode(
        email,
        hashCode("999999"),
        db,
        cooled(OTP_LIMITS.maxSendsPerWindow),
      );
      expect(commit.ok).toBe(false);
    });

    it("opens a fresh window once the old one has passed", async () => {
      const now = Date.now();
      for (let i = 0; i < OTP_LIMITS.maxSendsPerWindow; i++) {
        await replaceCode(email, hashCode(`00000${i}`), db, now + i * (OTP_LIMITS.resendCooldownMs + 1));
      }
      const later = now + OTP_LIMITS.sendWindowMs + 1;
      expect((await sendGate(email, db, later)).ok).toBe(true);
      await replaceCode(email, hashCode("777777"), db, later);
      expect((await row()).sendCount).toBe(1);
    });

    /**
     * The reason `sendGate` and `replaceCode` are two functions. A send that
     * never reached the mail server must cost the user nothing: no stored code,
     * no cooldown, no budget. This is that property stated directly — the route
     * test in app/api/auth/send-otp holds the ordering that produces it.
     */
    it("a precheck alone consumes nothing", async () => {
      const now = Date.now();
      expect((await sendGate(email, db, now)).ok).toBe(true);
      expect((await sendGate(email, db, now)).ok).toBe(true);
      expect(await row()).toBeUndefined();
    });
  });

  describe("generated codes", () => {
    it("are six digits and not all the same", async () => {
      const codes = new Set(Array.from({ length: 50 }, generateCode));
      for (const code of codes) expect(code).toMatch(/^\d{6}$/);
      expect(codes.size).toBeGreaterThan(20);
    });
  });
});
