import { describe, expect, it } from "vitest";
import { rulesBrief } from "../intent";
import { planSearch } from "../sourcing/vocabulary";

const text = "نبيع منتج لأتمتة الوصول لعملاء مستهدفين ونبحث عن شركات جديدة تريد الوصول الى عملاء";

describe("brief quality (request 661d2c88)", () => {
  it("doesn't read «نبيع منتج» as wanting product managers; targets buyers", () => {
    const b = rulesBrief(text);
    expect(b.goalType).toBe("sales");
    expect(b.targetRoles).not.toContain("مدير منتج فأعلى");
    expect(b.targetRoles).toContain("رئيس المبيعات");
    expect(b.industries).toContain("شركات ناشئة");
  });

  it("never sends the raw Arabic sentence to company search", () => {
    const plan = planSearch(rulesBrief(text), text);
    expect(plan.fallbackQuery).not.toMatch(/[؀-ۿ]/);
    expect(plan.industries.length || plan.fallbackQuery).toBeTruthy();
    expect(`${plan.fallbackQuery}`).toContain("startups");
  });

  it("still reads a real product-manager request", () => {
    expect(rulesBrief("أبي أوصل لمدير منتج في شركة تقنية مالية").targetRoles).toContain("مدير منتج فأعلى");
  });
});
