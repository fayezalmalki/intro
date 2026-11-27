import { describe, expect, it } from "vitest";
import { briefFromPicks, picksFromBrief, suggestedRoles } from "../intake";
import { planSearch } from "../sourcing/vocabulary";

describe("structured intake", () => {
  it("builds an exact brief the search runs on, no guessing", () => {
    const { brief, sectors, rawText } = briefFromPicks({ goal: "sales", sectors: ["Insurance", "Financial Services"], roles: ["Claims", "Chief Executive"], notes: "نبيع أتمتة المطالبات" });
    expect(brief.extractedBy).toBe("form");
    expect(sectors).toEqual(["Insurance", "Financial Services"]);
    const plan = planSearch(brief, rawText, sectors);
    expect(plan.industries).toEqual(["Insurance", "Financial Services"]);
    expect(plan.titles).toEqual(["Claims", "Chief Executive"]);
    expect(brief.targetRoles).toContain("رئيس المطالبات");
    expect(brief.summaryAr).toContain("التأمين");
  });

  it("uses the goal's default roles when none are picked", () => {
    const { brief } = briefFromPicks({ goal: "investment", sectors: ["Financial Services"], roles: [], notes: "" });
    expect(brief.roleTitles).toEqual(["Partner", "Investment"]);
  });

  it("maps a typed sector and role onto provider terms", () => {
    const { brief } = briefFromPicks({ goal: "sales", sectors: ["custom:شركات تأمين"], roles: ["custom:Head of Growth"], notes: "" });
    expect(brief.industryIds).toEqual(["Insurance"]);
    expect(brief.roleTitles).toEqual(["Head of Growth"]);
    expect(brief.industries).toEqual(["شركات تأمين"]);
  });

  it("suggests goal roles then sector roles, without repeats", () => {
    const titles = suggestedRoles("sales", ["Financial Services"]).map((r) => r.title);
    expect(titles.slice(0, 3)).toEqual(["Chief Executive", "Sales", "Marketing"]);
    expect(titles.filter((t) => t === "Chief Executive")).toHaveLength(1);
    expect(titles).toContain("Compliance");
  });

  it("prefills picks from a sentence and round-trips an edited brief", () => {
    expect(picksFromBrief(undefined, "نبي نوصل لشركات التأمين في الرياض").sectors).toContain("Insurance");
    const built = briefFromPicks({ goal: "partnership", sectors: ["Banking"], roles: ["Partnerships"], notes: "x" }).brief;
    expect(picksFromBrief(built, "")).toEqual({ goal: "partnership", sectors: ["Banking"], roles: ["Partnerships"], notes: "x" });
  });
});
