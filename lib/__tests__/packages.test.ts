import { describe, expect, it } from "vitest";
import { LIVE_TEST_PACK, PACKAGES, packageById } from "../billing/packages";

describe("credit packs", () => {
  it("offers the 1 SAR live test pack to admins only", () => {
    expect(packageById("live-test")).toBeUndefined();
    expect(packageById("live-test", { admin: true })).toEqual(LIVE_TEST_PACK);
    expect(PACKAGES.some((p) => p.id === "live-test")).toBe(false);
    expect(LIVE_TEST_PACK.sar * 100).toBeGreaterThanOrEqual(100); // Moyasar's minimum
    expect(packageById("starter")?.sar).toBe(99);
  });
});
