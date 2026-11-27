import { describe, expect, it } from "vitest";
import { PLATFORM_DAILY_CAP, checkOutbound, workEmailMatchesCompany, type OutboundContext } from "../outbound";
import { optOutToken, readOptOutToken } from "../optout";

const ok: OutboundContext = {
  eligible: true, paused: false, configured: true, emailStatus: "valid", suppressed: false, contactedByOthers: false,
  step: 0, sentToday: 0, dailyCap: 10, platformSentToday: 0, recentFirstBodies: [],
};
const body = "Hi Faisal,\n\nI saw Qimma is hiring three claims handlers this month — we help claims teams cut handling time by a third. Worth 20 minutes next week?\n\nNoura";

describe("sending through intro: checks", () => {
  it("lets a clean first message through", () => expect(checkOutbound(ok, body)).toEqual([]));

  it("refuses for each guard", () => {
    expect(checkOutbound({ ...ok, configured: false }, body)).toContain("not_configured");
    expect(checkOutbound({ ...ok, eligible: false }, body)).toContain("not_eligible");
    expect(checkOutbound({ ...ok, paused: true }, body)).toContain("paused");
    expect(checkOutbound({ ...ok, emailStatus: "risky" }, body)).toContain("unverified_email");
    expect(checkOutbound({ ...ok, suppressed: true }, body)).toContain("suppressed");
    expect(checkOutbound({ ...ok, contactedByOthers: true }, body)).toContain("recipient_cooldown");
    expect(checkOutbound({ ...ok, step: 3 }, body)).toContain("sequence_done");
    expect(checkOutbound({ ...ok, sentToday: 10 }, body)).toContain("daily_cap");
    expect(checkOutbound({ ...ok, platformSentToday: PLATFORM_DAILY_CAP }, body)).toContain("platform_cap");
    expect(checkOutbound(ok, "Hi, quick one?")).toContain("too_short");
    expect(checkOutbound(ok, `${body} https://a.sa https://b.sa https://c.sa`)).toContain("too_many_links");
  });

  it("catches a copy-paste blast on first messages, not on follow-up templates", () => {
    const same = body.replace("Faisal", "Reem");
    expect(checkOutbound({ ...ok, recentFirstBodies: [body] }, same)).toContain("near_duplicate");
    expect(checkOutbound({ ...ok, step: 1, recentFirstBodies: [body] }, same)).not.toContain("near_duplicate");
  });
});

describe("verification by work email", () => {
  it("accepts a work email on the company's domain", () => {
    expect(workEmailMatchesCompany("noura@lumenpay.sa", "https://www.lumenpay.sa/about")).toBe(true);
    expect(workEmailMatchesCompany("noura@ksa.lumenpay.sa", "lumenpay.sa")).toBe(true);
  });
  it("rejects personal mail and mismatches", () => {
    expect(workEmailMatchesCompany("noura@gmail.com", "gmail.com")).toBe(false);
    expect(workEmailMatchesCompany("noura@other.sa", "lumenpay.sa")).toBe(false);
    expect(workEmailMatchesCompany("noura@lumenpay.sa", null)).toBe(false);
  });
});

describe("opt-out links", () => {
  it("round-trips and refuses tampering", () => {
    const t = optOutToken("Faisal@Qimma.sa", "secret");
    expect(readOptOutToken(t, "secret")).toBe("faisal@qimma.sa");
    expect(readOptOutToken(t, "other-secret")).toBeNull();
    const [, sig] = t.split(".");
    expect(readOptOutToken(`${Buffer.from("reem@qimma.sa").toString("base64url")}.${sig}`, "secret")).toBeNull();
  });
});
