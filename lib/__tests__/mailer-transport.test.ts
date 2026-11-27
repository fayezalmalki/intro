import { describe, expect, it } from "vitest";
import { transportFor } from "../mailer";

describe("mail transport", () => {
  const binding = {} as SendEmail;
  it("uses ImprovMX SMTP when its login is set, even with the Cloudflare binding present", () => {
    expect(transportFor({ IMPROVMX_SMTP_USER: "noreply@intro.sa", IMPROVMX_SMTP_PASSWORD: "x", EMAIL: binding })).toBe("smtp");
  });
  it("falls back to the Cloudflare binding, then to logging", () => {
    expect(transportFor({ IMPROVMX_SMTP_USER: "noreply@intro.sa", EMAIL: binding })).toBe("binding");
    expect(transportFor({})).toBe("log");
  });
});
