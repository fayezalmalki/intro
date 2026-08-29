import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The transport rules ported from careers.sa, each of which stands for a
 * production failure that took real time to diagnose:
 *
 *   • TLS inferred from the port — a `secure: false` transport pointed at 465
 *     hangs until the connection timeout, so every send in the logs said
 *     "timeout" while the credentials were perfectly fine.
 *   • Retry the alternate port, but only on connection-class errors — a
 *     rejected password fails identically on the other port, and retrying it
 *     doubles the time before the user is told anything useful.
 *   • Classify the failure — "auth" and "timeout" need different actions from
 *     different people, and one message for both is a message for neither.
 */

const sendMail = vi.fn();
const created: { port: number; secure: boolean; auth: { user: string } }[] = [];

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (options: { port: number; secure: boolean; auth: { user: string } }) => {
      created.push(options);
      return { sendMail };
    },
  },
}));

const connectionError = (code: string) => Object.assign(new Error(`connect ${code}`), { code });
const authError = () => Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 });

describe("mailer", () => {
  beforeEach(() => {
    created.length = 0;
    sendMail.mockReset();
    vi.stubEnv("SMTP_PASSWORD", "pw");
  });
  afterEach(() => vi.unstubAllEnvs());

  describe("sender identity", () => {
    it("defaults to noreply@intro.sa", async () => {
      const { resolveSender } = await import("../mailer");
      expect(resolveSender()).toMatchObject({
        user: "noreply@intro.sa",
        from: "Intro <noreply@intro.sa>",
      });
    });

    /**
     * The hard rule from docs/sending-domains.md, enforced rather than
     * documented: bounces on addresses intro.sa guessed must never land on the
     * domain that carries careers.sa's own sign-in mail.
     */
    it("refuses to authenticate as another product's domain", async () => {
      vi.stubEnv("SMTP_USER", "jobs@careers.sa");
      const { isEmailConfigured, resolveSender } = await import("../mailer");
      expect(() => resolveSender()).toThrow(/intro\.sa/);
      expect(isEmailConfigured()).toBe(false);
    });

    /** The any-alias credential is the point: any mailbox, same domain. */
    it("allows any alias on intro.sa, and a FROM on the same domain", async () => {
      vi.stubEnv("SMTP_USER", "any-alias-1@intro.sa");
      vi.stubEnv("SMTP_FROM", "Intro <hello@intro.sa>");
      const { resolveSender } = await import("../mailer");
      expect(resolveSender()).toMatchObject({
        user: "any-alias-1@intro.sa",
        from: "Intro <hello@intro.sa>",
      });
    });

    it("ignores a FROM the credential could not send as", async () => {
      vi.stubEnv("SMTP_FROM", "Careers <jobs@careers.sa>");
      const { resolveSender } = await import("../mailer");
      expect(resolveSender().from).toBe("Intro <noreply@intro.sa>");
    });
  });

  describe("port and TLS", () => {
    it("infers TLS from the port and keeps the other standard pair as a fallback", async () => {
      const { smtpCandidates } = await import("../mailer");

      vi.stubEnv("SMTP_PORT", "");
      expect(smtpCandidates()).toEqual([
        { port: 587, secure: false },
        { port: 465, secure: true },
      ]);

      vi.stubEnv("SMTP_PORT", "465");
      expect(smtpCandidates()).toEqual([
        { port: 465, secure: true },
        { port: 587, secure: false },
      ]);
    });

    it("lets SMTP_SECURE override the inference", async () => {
      vi.stubEnv("SMTP_PORT", "2525");
      vi.stubEnv("SMTP_SECURE", "true");
      const { smtpCandidates } = await import("../mailer");
      expect(smtpCandidates()[0]).toEqual({ port: 2525, secure: true });
    });

    it("retries the alternate port on a connection failure", async () => {
      sendMail.mockRejectedValueOnce(connectionError("ETIMEDOUT")).mockResolvedValueOnce({});
      const { sendOtpEmail } = await import("../mailer");

      await sendOtpEmail("f@x.sa", "123456");

      expect(created.map((t) => [t.port, t.secure])).toEqual([
        [587, false],
        [465, true],
      ]);
    });

    it("does not retry an authentication failure", async () => {
      sendMail.mockRejectedValue(authError());
      const { sendOtpEmail } = await import("../mailer");

      await expect(sendOtpEmail("f@x.sa", "123456")).rejects.toThrow(/Invalid login/);
      expect(created).toHaveLength(1);
    });

    it("gives up after both ports, surfacing the last error", async () => {
      sendMail.mockRejectedValue(connectionError("ECONNREFUSED"));
      const { sendOtpEmail } = await import("../mailer");

      await expect(sendOtpEmail("f@x.sa", "123456")).rejects.toThrow(/ECONNREFUSED/);
      expect(created).toHaveLength(2);
    });
  });

  describe("failure classification", () => {
    it("names each class, with copy that differs", async () => {
      const { classifySmtpError, SMTP_FAILURE_MESSAGES, EmailNotConfiguredError } =
        await import("../mailer");

      expect(classifySmtpError(authError())).toBe("auth");
      expect(classifySmtpError({ responseCode: 535 })).toBe("auth");
      expect(classifySmtpError({ responseCode: 550, message: "MAIL FROM rejected" })).toBe(
        "from_rejected",
      );
      expect(classifySmtpError(connectionError("ETIMEDOUT"))).toBe("timeout");
      expect(classifySmtpError(new EmailNotConfiguredError())).toBe("not_configured");
      expect(classifySmtpError(new Error("something else"))).toBe("other");

      const messages = Object.values(SMTP_FAILURE_MESSAGES);
      expect(new Set(messages).size).toBe(messages.length);
    });

    it("never puts the code or the password in a failure message", async () => {
      const { SMTP_FAILURE_MESSAGES } = await import("../mailer");
      for (const message of Object.values(SMTP_FAILURE_MESSAGES)) {
        expect(message).not.toMatch(/\d{6}/);
        expect(message).not.toContain("pw");
      }
    });
  });
});
