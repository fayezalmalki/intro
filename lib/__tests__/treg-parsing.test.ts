import { describe, expect, it } from "vitest";
import { TregProvider } from "../sourcing/treg";

const answering = (output: unknown) => (async () => new Response(JSON.stringify({ output, _treg: { served_by: "x" } }), { status: 200, headers: { "x-treg-cost-micro": "10" } })) as unknown as typeof fetch;
const opts = { maxCostUsd: 0.03, idempotencyKey: "k" };

describe("treg answers in odd shapes", () => {
  it("keeps good company rows and skips odd ones without failing the search", async () => {
    const treg = new TregProvider("t", answering({ companies: [
      { name: ["Aramco Ventures"], domain: "aramcoventures.com", industry: ["Venture Capital"], company_size: 120 },
      { organization: "Wadi Makkah", domain: "wadimakkah.sa" },
      { name: { en: "Odd" }, domain: { value: "odd.sa" } },
      { name: "No domain" },
    ] }));
    const r = await treg.findCompanies({ q: "vc", country: "SA", limit: 25 }, opts);
    expect(r.value).toEqual([
      { name: "Aramco Ventures", domain: "aramcoventures.com", industry: "Venture Capital", size: "120", linkedinUrl: undefined },
      { name: "Wadi Makkah", domain: "wadimakkah.sa", industry: undefined, size: undefined, linkedinUrl: undefined },
    ]);
  });

  it("does the same for people and news", async () => {
    const people = await new TregProvider("t", answering({ people: [{ name: "Reem", title: ["Head of Claims"], company: 7 }, { name: null, title: "x" }] }))
      .searchPeople({ companyDomain: "x.sa", title: "Head", limit: 20 }, opts);
    expect(people.value.map((p) => [p.name, p.title])).toEqual([["Reem", "Head of Claims"]]);
    const news = await new TregProvider("t", answering({ results: [{ url: "https://a.sa/x", title: "Raised a round", date: 20261101 }, { url: 5, title: "bad" }] }))
      .findSignals({ q: "x", limit: 5 }, opts);
    expect(news.value.map((n) => n.title)).toEqual(["Raised a round"]);
  });
});
