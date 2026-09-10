import { describe, expect, it } from "vitest";
import { CHURN_LIMIT, MIN_BASELINE_FOR_CHURN, diffSeats } from "../detect";

/** A baseline big enough that the churn guard's ratio is meaningful. */
const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("diffSeats", () => {
  it("reports nothing on the first run, and stores the set instead", () => {
    const out = diffSeats({ previous: null, current: [7, 3, 9] });
    expect(out.changes).toEqual([]);
    expect(out.skipped).toBe("first_run");
    // Sorted, so next week's stored baseline compares byte for byte.
    expect(out.baseline).toEqual([3, 7, 9]);
  });

  it("names an arrival and a departure against a baseline", () => {
    const out = diffSeats({ previous: TEN, current: [...TEN.filter((n) => n !== 4), 11] });
    expect(out.skipped).toBeNull();
    expect(out.changes).toContainEqual({ coresignalEmployeeId: 11, kind: "arrival" });
    expect(out.changes).toContainEqual({ coresignalEmployeeId: 4, kind: "departure" });
    expect(out.changes).toHaveLength(2);
  });

  it("is order-independent and ignores duplicates", () => {
    const out = diffSeats({ previous: [3, 1, 2, 2], current: [2, 3, 1] });
    expect(out.changes).toEqual([]);
    expect(out.skipped).toBeNull();
  });

  /**
   * The one that matters most. A dead key, a renamed field or a company id that
   * stopped resolving all return zero ids — which the naive diff reads as an
   * entire leadership team resigning in the same week, and publishes.
   */
  it("treats a total wipe as breakage, never as departures", () => {
    const out = diffSeats({ previous: TEN, current: [] });
    expect(out.changes).toEqual([]);
    expect(out.skipped).toBe("empty_result");
    // The good baseline survives, so a recovered run diffs against truth.
    expect(out.baseline).toEqual(TEN);
  });

  it("still allows an empty result when the baseline was empty too", () => {
    const out = diffSeats({ previous: [], current: [] });
    expect(out.skipped).toBeNull();
    expect(out.changes).toEqual([]);
  });

  /**
   * `search/filter` answers with a page and a total. Ids that did not fit in
   * the page are indistinguishable from people who left.
   */
  it("refuses to diff a truncated result, and keeps the old baseline", () => {
    const out = diffSeats({ previous: TEN, current: [1, 2, 3], total: 40 });
    expect(out.changes).toEqual([]);
    expect(out.skipped).toBe("truncated");
    expect(out.baseline).toEqual(TEN);
  });

  it("diffs normally when the total matches what came back", () => {
    const out = diffSeats({ previous: TEN, current: [...TEN, 11], total: 11 });
    expect(out.skipped).toBeNull();
    expect(out.changes).toEqual([{ coresignalEmployeeId: 11, kind: "arrival" }]);
  });

  it("rejects churn past the limit as a query change, not a hiring spree", () => {
    // Ten seats, nine of them different: 18 changes over a baseline of 10.
    const out = diffSeats({ previous: TEN, current: [1, 21, 22, 23, 24, 25, 26, 27, 28, 29] });
    expect(out.skipped).toBe("implausible_churn");
    expect(out.baseline).toEqual(TEN);
  });

  it("accepts churn just under the limit", () => {
    // Two arrivals + two departures over ten = 0.4, under CHURN_LIMIT.
    const out = diffSeats({ previous: TEN, current: [1, 2, 3, 4, 5, 6, 7, 8, 21, 22] });
    expect((2 + 2) / TEN.length).toBeLessThan(CHURN_LIMIT);
    expect(out.skipped).toBeNull();
    expect(out.changes).toHaveLength(4);
  });

  /**
   * Ratios are meaningless on tiny sets: a two-person company replacing one
   * person is 100% churn and entirely ordinary.
   */
  it("does not apply the churn guard below the minimum baseline", () => {
    const small = [1, 2, 3];
    expect(small.length).toBeLessThan(MIN_BASELINE_FOR_CHURN);
    const out = diffSeats({ previous: small, current: [4, 5, 6] });
    expect(out.skipped).toBeNull();
    expect(out.changes).toHaveLength(6);
  });

  it("never emits the same id as both an arrival and a departure", () => {
    const out = diffSeats({ previous: [1, 2, 3, 4, 5, 6], current: [4, 5, 6, 7, 8, 9] });
    const arrivals = out.changes.filter((c) => c.kind === "arrival").map((c) => c.coresignalEmployeeId);
    const departures = out.changes.filter((c) => c.kind === "departure").map((c) => c.coresignalEmployeeId);
    expect(arrivals.some((id) => departures.includes(id))).toBe(false);
  });
});
