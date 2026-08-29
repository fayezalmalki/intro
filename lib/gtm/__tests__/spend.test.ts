import { describe, expect, it } from "vitest";
import {
  COMPANY_COLLECT_CREDITS,
  PERSON_COLLECT_CREDITS,
  confirmSpend,
  planCollect,
  spendLabel,
  type CollectableRow,
} from "../spend";
import { buildCompanyQuery, countSegment, describeQuery, NO_KEY_REASON } from "../counts";

/**
 * The cost rules, tested as rules rather than as code paths.
 *
 * Every assertion here corresponds to a way of spending 20 credits on nothing.
 */

function row(id: string, over: Partial<CollectableRow> = {}): CollectableRow {
  return { id, kept: true, coresignalId: Number(id.replace(/\D/g, "")) || 1, ...over };
}

describe("planCollect", () => {
  it("prices only the rows the user kept", () => {
    const plan = planCollect([row("1"), row("2"), row("3", { kept: false })]);
    expect(plan.buy).toEqual(["1", "2"]);
    expect(plan.credits).toBe(2 * PERSON_COLLECT_CREDITS);
  });

  /** apiCallLog serves a repeat purchase from the stored response, for free. */
  it("charges nothing for a row already bought", () => {
    const plan = planCollect([row("1", { collectedAt: "2026-01-01T00:00:00Z" }), row("2")]);
    expect(plan.buy).toEqual(["2"]);
    expect(plan.alreadyOwned).toEqual(["1"]);
    expect(plan.credits).toBe(PERSON_COLLECT_CREDITS);
  });

  /** No vendor id is not a cheap purchase, it is a failed call. */
  it("sets aside rows with nothing to buy", () => {
    const plan = planCollect([row("1", { coresignalId: null }), row("2")]);
    expect(plan.unbuyable).toEqual(["1"]);
    expect(plan.credits).toBe(PERSON_COLLECT_CREDITS);
  });

  it("prices a company collect at the company rate", () => {
    expect(planCollect([row("1")], COMPANY_COLLECT_CREDITS).credits).toBe(10);
    expect(PERSON_COLLECT_CREDITS).toBe(20);
  });

  it("is zero for an empty selection", () => {
    expect(planCollect([]).credits).toBe(0);
    expect(planCollect([row("1", { kept: false })]).credits).toBe(0);
  });
});

describe("confirmSpend", () => {
  it("allows a spend whose amount matches what the user was shown", () => {
    const verdict = confirmSpend([row("1"), row("2")], 40, 1730);
    expect(verdict.allowed).toBe(true);
    expect(verdict.plan.credits).toBe(40);
  });

  /**
   * The whole reason the confirmation carries a number. If a row was kept in
   * another tab between render and submit, the page the user agreed to is not
   * the page being executed, and the difference is real money.
   */
  it("refuses when the amount changed after the user saw it", () => {
    const verdict = confirmSpend([row("1"), row("2"), row("3")], 40, 1730);
    expect(verdict.allowed).toBe(false);
    expect(verdict.refusal).toBe("confirmation_mismatch");
    expect(verdict.plan.credits).toBe(60);
  });

  it("refuses a confirmation of zero against a real plan", () => {
    expect(confirmSpend([row("1")], 0, 1730).refusal).toBe("confirmation_mismatch");
  });

  it("refuses when nothing was kept", () => {
    expect(confirmSpend([row("1", { kept: false })], 0, 1730).refusal).toBe("nothing_to_buy");
  });

  it("refuses when the vendor balance cannot cover it", () => {
    const verdict = confirmSpend([row("1"), row("2")], 40, 30);
    expect(verdict.allowed).toBe(false);
    expect(verdict.refusal).toBe("insufficient_vendor_credits");
  });

  /**
   * A balance we have never observed is not a balance of zero. The vendor
   * enforces its own limit; blocking here would break the product over a
   * header we simply have not seen yet.
   */
  it("proceeds when no vendor balance has ever been observed", () => {
    expect(confirmSpend([row("1")], 20, null).allowed).toBe(true);
  });

  it("names the count and the cost in the button label", () => {
    expect(spendLabel(planCollect([row("1"), row("2")]))).toBe("2 صف · 40 رصيد");
  });
});

describe("segment counts", () => {
  it("builds the vendor's own filter shape", () => {
    expect(
      buildCompanyQuery({ country: "Saudi Arabia", employeesMin: 50, employeesMax: 200 }),
    ).toEqual({ country: "Saudi Arabia", employees_count_gte: 50, employees_count_lte: 200 });
  });

  /** Four ANDed keywords return zero, which reads as "no such companies". */
  it("sends one keyword, not the whole list", () => {
    const query = buildCompanyQuery({ country: "SA", keywords: ["fintech", "payments", "b2b"] });
    expect(query.keyword).toBe("fintech");
  });

  it("returns a real total together with the query that produced it", async () => {
    const client = {
      searchCompanies: async () => ({ ids: [1, 2], total: 8092, creditsRemaining: 1730 }),
    };
    const count = await countSegment({ country: "Saudi Arabia", employeesMin: 50 }, client);
    expect(count.source).toBe("coresignal");
    expect(count.total).toBe(8092);
    expect(count.query).toEqual({ country: "Saudi Arabia", employees_count_gte: 50 });
    expect(count.endpoint).toBe("company_base/search/filter");
  });

  /** No key is not a reason to show a number. It is a reason to show a reason. */
  it("returns no number at all without a client", async () => {
    const count = await countSegment({ country: "Saudi Arabia" }, null);
    expect(count.source).toBe("unavailable");
    expect(count.total).toBeNull();
    expect(count.error).toBe(NO_KEY_REASON);
    // The query still exists, so the card can show what *would* be asked.
    expect(count.query.country).toBe("Saudi Arabia");
  });

  it("degrades one card rather than failing the run when the vendor errors", async () => {
    const client = {
      searchCompanies: async () => {
        throw new Error("coresignal company_base/search/filter failed: 429 rate limited");
      },
    };
    const count = await countSegment({ country: "Saudi Arabia" }, client);
    expect(count.source).toBe("unavailable");
    expect(count.total).toBeNull();
    expect(count.error).toContain("429");
  });

  /** A response with no x-total-results header has no count in it. */
  it("refuses to invent a total from the returned page of ids", async () => {
    const client = {
      searchCompanies: async () => ({ ids: [1, 2, 3], total: null, creditsRemaining: 1730 }),
    };
    const count = await countSegment({ country: "Saudi Arabia" }, client);
    expect(count.source).toBe("unavailable");
    expect(count.total).toBeNull();
    expect(count.ids).toEqual([1, 2, 3]);
  });

  it("renders the query as a line a person can read", () => {
    expect(describeQuery({ country: "Saudi Arabia", employees_count_gte: 50 }))
      .toBe("country=Saudi Arabia · employees≥50");
  });
});
