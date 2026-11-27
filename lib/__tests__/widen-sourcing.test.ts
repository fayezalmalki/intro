import { describe, expect, it } from "vitest";
import type { CallOptions, Company, FoundPerson, Priced, Signal, SourcingProvider } from "../sourcing/provider";
import { runSourcing } from "../sourcing/run";
import type { Brief } from "../types";

const brief: Brief = {
  goalType: "sales", targetRoles: ["رئيس المبيعات"], seniority: [], industries: ["التأمين"], geos: ["السعودية"],
  inclusions: [], exclusions: [], summaryAr: "", confidence: 0.95, extractedBy: "form", industryIds: ["Insurance"], roleTitles: ["Sales"],
};
const person = (name: string, title: string, domain: string, location?: string): FoundPerson =>
  ({ name, title, company: domain.split(".")[0], companyDomain: domain, profileUrl: `https://www.linkedin.com/in/${name.replace(/\s/g, "-").toLowerCase()}`, location, servedBy: "fake" });

class Fake implements SourcingProvider {
  calls: { tool: string; query: Record<string, unknown> }[] = [];
  constructor(private companies: number, private perCompany: (domain: string, title?: string) => FoundPerson[], private sector: FoundPerson[] = []) {}
  async findCompanies(query: Record<string, unknown>): Promise<Priced<Company[]>> {
    this.calls.push({ tool: "companies", query });
    return { costMicro: 100, value: Array.from({ length: this.companies }, (_, i) => ({ name: `Co${i}`, domain: `co${i}.sa`, industry: "Insurance" })) };
  }
  async findPeople(query: { companyDomain: string; title?: string }): Promise<Priced<FoundPerson[]>> {
    this.calls.push({ tool: query.title ? "people-role" : "people", query });
    return { costMicro: 100, value: this.perCompany(query.companyDomain, query.title) };
  }
  async findPeopleInSector(query: Record<string, unknown>, _o: CallOptions): Promise<Priced<FoundPerson[]>> {
    this.calls.push({ tool: "sector", query });
    return { costMicro: 100, value: this.sector };
  }
  async findSignals(): Promise<Priced<Signal[]>> { return { costMicro: 100, value: [] }; }
}

const input = { requestId: "r", brief, rawText: "x", sectors: ["Insurance"] };

describe("wider sourcing", () => {
  it("tries up to 12 companies and stops once 15 people are found", async () => {
    const p = new Fake(20, (d) => [person(`CEO ${d}`, "Chief Executive Officer", d), person(`Sales ${d}`, "Head of Sales", d), person(`Ops ${d}`, "Operations Clerk", d)]);
    const r = await runSourcing(input, { provider: p });
    expect(r.candidates.length).toBeGreaterThanOrEqual(15);
    expect(p.calls.filter((c) => c.tool.startsWith("people")).length).toBeLessThanOrEqual(8);
    expect(r.candidates.some((c) => c.person.title === "Operations Clerk")).toBe(false);
  });

  it("asks for each picked role in turn, and ignores junior title matches", async () => {
    const twoRoles = { ...input, brief: { ...brief, roleTitles: ["Sales", "Marketing"] } };
    const p = new Fake(1, (d, title) => (title === "Sales"
      ? [person(`Rep ${d}`, "Outside Sales Representative", d), person(`Spec ${d}`, "Sales And Marketing Specialist", d)]
      : [person(`Mkt ${d}`, "Marketing Manager", d)]));
    const r = await runSourcing(twoRoles, { provider: p });
    expect(p.calls.filter((c) => c.tool === "people-role").map((c) => c.query.title)).toEqual(["Sales", "Marketing"]);
    expect(r.candidates.map((c) => c.person.title)).toEqual(["Marketing Manager"]);
  });

  it("searches the role across the sector when companies yield too few, keeping the market", async () => {
    const p = new Fake(2, () => [], [
      person("Reem", "Head of Sales", "qimma.sa", "Riyadh, Saudi Arabia"),
      person("John", "Head of Sales", "acme.co.uk", "London, United Kingdom"),
    ]);
    const r = await runSourcing(input, { provider: p });
    expect(p.calls.some((c) => c.tool === "sector")).toBe(true);
    expect(r.candidates.map((c) => c.person.name)).toEqual(["Reem"]);
  });
});
