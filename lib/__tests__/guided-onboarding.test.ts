import { describe, expect, it } from "vitest";
import { firstSearch, isIntentfulNext, parseSource } from "../onboarding";

describe("guided onboarding", () => {
  it("recognises LinkedIn profiles in the forms people paste", () => {
    expect(parseSource("https://sa.linkedin.com/in/fayezalmalki/")).toEqual({ kind: "linkedin", url: "https://www.linkedin.com/in/fayezalmalki" });
    expect(parseSource("linkedin.com/in/noura-a?trk=x")).toEqual({ kind: "linkedin", url: "https://www.linkedin.com/in/noura-a" });
    expect(parseSource("www.linkedin.com/company/tamara")).toBeNull();
  });

  it("reads anything else domain-shaped as a website", () => {
    expect(parseSource("https://www.Tamara.co/en/about")).toEqual({ kind: "website", domain: "tamara.co" });
    expect(parseSource("lumenpay.sa")).toEqual({ kind: "website", domain: "lumenpay.sa" });
    expect(parseSource("not a link")).toBeNull();
    expect(parseSource("")).toBeNull();
  });

  it("turns the answers into a first search that runs on arrival", () => {
    const u = new URL(firstSearch({ goal: "sell", sector: "Insurance", who: "procurement", market: "AE" }, "en"), "https://intro.sa");
    expect(u.pathname).toBe("/search");
    expect(Object.fromEntries(u.searchParams)).toEqual({ lang: "en", market: "AE", mode: "companies", sector: "Insurance", role: "Procurement", run: "1" });
  });

  it("defaults investors to VC firms and the first role when none was picked", () => {
    const u = new URL(firstSearch({ goal: "invest", market: "SA" }, "ar"), "https://intro.sa");
    expect(u.searchParams.get("sector")).toBe("Venture Capital & Private Equity");
    expect(u.searchParams.get("role")).toBe("Partner");
  });

  it("searches people directly for hiring", () => {
    const u = new URL(firstSearch({ goal: "hire", sector: "Financial Services", who: "engineering", market: "SA" }, "en"), "https://intro.sa");
    expect(u.searchParams.get("mode")).toBe("people");
    expect(u.searchParams.get("describe")).toBe("Engineering leaders in Fintech & financial services");
  });

  it("keeps what a visitor asked for before signing up", () => {
    expect(isIntentfulNext("/search?mode=people&q=heads+of+claims&run=1")).toBe(true);
    expect(isIntentfulNext("/new?q=Sell+payroll")).toBe(true);
    expect(isIntentfulNext("/home?welcome=1")).toBe(false);
    expect(isIntentfulNext("/new")).toBe(false);
  });
});
