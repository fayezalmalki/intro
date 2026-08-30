import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * The ordering property, tested where it lives: **precheck → send → commit**.
 *
 * This is the whole point of the route's shape. A failed send must store no
 * code and consume no cooldown, because the fault was ours and the user should
 * be able to press the button again immediately. Until this change the route
 * inserted the code first and sent afterwards, so a broken mailer locked
 * everyone out of their own account for a minute at a time while telling them
 * nothing about why.
 *
 * The database is the real (PGlite) one — the counters are the thing under
 * test — and only the mailer is a stub.
 */

const sent: { to: string; code: string }[] = [];
let failWith: (Error & { code?: string; responseCode?: number }) | null = null;

vi.mock("@/lib/mailer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailer")>("@/lib/mailer");
  return {
    ...actual,
    isEmailConfigured: () => true,
    sendOtpEmail: vi.fn(async (to: string, code: string) => {
      if (failWith) throw failWith;
      sent.push({ to, code });
    }),
  };
});

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("@/lib/db/testing");
  const db = await testDb();
  return { db, resolveDb: () => db, schema: await import("@/lib/db/schema") };
});

const post = async (email: unknown) => {
  const { POST } = await import("../route");
  const response = await POST(
    new Request("http://localhost/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
};

describe("POST /api/auth/send-otp", () => {
  beforeEach(async () => {
    const { reset, testDb } = await import("@/lib/db/testing");
    await reset(await testDb());
    sent.length = 0;
    failWith = null;
  });

  const codes = async () => {
    const { testDb } = await import("@/lib/db/testing");
    const { otpCodes } = await import("@/lib/db/schema");
    return (await testDb()).select().from(otpCodes);
  };

  it("rejects an address that is not one", async () => {
    const { response, body } = await post("not-an-email");
    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_email");
    expect(await codes()).toHaveLength(0);
  });

  it("sends a code and stores only its hash", async () => {
    const { response, body } = await post("F@X.sa");
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, expiresInMinutes: 10 });

    // Never echoed. The code leaves the server inside the email and nowhere else.
    expect(JSON.stringify(body)).not.toContain(sent[0].code);

    const { hashCode } = await import("@/lib/otp");
    const rows = await codes();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("f@x.sa");
    expect(rows[0].codeHash).toBe(hashCode(sent[0].code));
  });

  describe("a failed send consumes nothing", () => {
    it("stores no code and starts no cooldown", async () => {
      failWith = Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 });

      const { response, body } = await post("f@x.sa");
      expect(response.status).toBe(502);
      expect(await codes()).toHaveLength(0);

      // Distinct, actionable copy per class — "auth" is not "try again shortly".
      const { SMTP_FAILURE_MESSAGES } = await import("@/lib/mailer");
      expect(body.message).toBe(SMTP_FAILURE_MESSAGES.auth);

      // And the very next request goes straight through: no cooldown was spent.
      failWith = null;
      const retry = await post("f@x.sa");
      expect(retry.response.status).toBe(200);
      expect(sent).toHaveLength(1);
    });

    it("records the failure class for the ops page", async () => {
      failWith = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
      await post("f@x.sa");

      const { testDb } = await import("@/lib/db/testing");
      const { usageEvents } = await import("@/lib/db/schema");
      const rows = await (await testDb())
        .select().from(usageEvents).where(eq(usageEvents.kind, "otp_send_failed"));
      expect(rows).toHaveLength(1);
      expect((rows[0].meta as { class: string }).class).toBe("timeout");
    });
  });

  it("refuses a resend inside the cooldown, with a Retry-After", async () => {
    await post("f@x.sa");
    const { response, body } = await post("f@x.sa");

    expect(response.status).toBe(429);
    expect(body.error).toBe("too_soon");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    // The refusal did not replace the live code.
    expect(sent).toHaveLength(1);
    expect(await codes()).toHaveLength(1);
  });
});
