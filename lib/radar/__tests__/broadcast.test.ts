import { describe, expect, it } from "vitest";
import { RADAR_ENABLED_ENV, RADAR_SENDER_ENV, broadcastPlan } from "../broadcast";

/**
 * The pool rule from docs/sending-domains.md, as a test. Radar is bulk mail and
 * pool 1 carries sign-in codes; the two must never share a domain, so the only
 * way to enable a broadcast is to name a subdomain sender.
 */
describe("broadcastPlan", () => {
  it("is off by default, and says what is missing", () => {
    const plan = broadcastPlan({});
    expect(plan.enabled).toBe(false);
    expect(plan.refusal).toBe("no_radar_sender");
    expect(plan.reason).toContain("sending subdomain");
  });

  it("refuses intro.sa itself — that is pool 1 under another name", () => {
    const plan = broadcastPlan({ [RADAR_SENDER_ENV]: "radar@intro.sa", [RADAR_ENABLED_ENV]: "1" });
    expect(plan.enabled).toBe(false);
    expect(plan.refusal).toBe("no_radar_sender");
    expect(plan.reason).toContain("subdomain of intro.sa");
  });

  it("refuses an unrelated domain", () => {
    const plan = broadcastPlan({ [RADAR_SENDER_ENV]: "radar@example.com", [RADAR_ENABLED_ENV]: "1" });
    expect(plan.enabled).toBe(false);
    expect(plan.refusal).toBe("no_radar_sender");
  });

  it("stays off with a valid sender until the flag is set, and says so", () => {
    const plan = broadcastPlan({ [RADAR_SENDER_ENV]: "briefing@radar.intro.sa" });
    expect(plan.enabled).toBe(false);
    expect(plan.refusal).toBe("disabled");
    expect(plan.sender).toBe("briefing@radar.intro.sa");
    expect(plan.reason).toContain("published to its public page");
  });

  it("enables only with a subdomain sender and the flag together", () => {
    const plan = broadcastPlan({
      [RADAR_SENDER_ENV]: "briefing@radar.intro.sa", [RADAR_ENABLED_ENV]: "1",
    });
    expect(plan.enabled).toBe(true);
    expect(plan.refusal).toBeNull();
  });
});
