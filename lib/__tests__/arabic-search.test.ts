import { describe, expect, it } from "vitest";
import { toProviderTerms } from "../search/arabic";

describe("Arabic search words", () => {
  it("turns «شركة تقنية» into the technology industry, with nothing left over", () => {
    expect(toProviderTerms("شركة تقنية")).toEqual({ terms: "", industry: "Information Technology & Services", titles: [], untranslated: [] });
  });

  it("prefers the longer sector («تقنية مالية» is fintech, not tech)", () => {
    expect(toProviderTerms("شركات التقنية المالية في الرياض").industry).toBe("Financial Services");
  });

  it("translates descriptive words and drops filler", () => {
    const t = toProviderTerms("شركات عالمية دخلت حديثا السوق السعودي");
    expect(t.terms).toBe("international");
    expect(t.untranslated).toEqual([]);
  });

  it("finds roles and sectors for people searches", () => {
    const t = toProviderTerms("مدراء المشتريات في المستشفيات الخاصة");
    expect(t.titles).toContain("Procurement");
    expect(t.industry).toBe("Hospital & Health Care");
  });

  it("keeps Latin words and reports Arabic it could not translate", () => {
    const t = toProviderTerms("شركات BNPL للتمور");
    expect(t.terms).toBe("BNPL");
    expect(t.untranslated).toEqual(["تمور"]);
  });
});

describe("sector dictionary in Arabic search", () => {
  it("maps «صناديق استثمار» to investors with nothing left over", () => {
    const t = toProviderTerms("صناديق استثمار");
    expect(t.industry).toBe("Venture Capital & Private Equity");
    expect(t.untranslated).toEqual([]);
  });
  it("maps colloquial plurals («مستوصفات» aside) like «وزارات» to government", () => {
    expect(toProviderTerms("وزارات").industry).toBe("Government Administration");
  });
});
