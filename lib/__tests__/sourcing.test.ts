import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers, people, pipelineItems, pipelines, requests } from "../db/schema";
import type { Database } from "../db";
import type { Brief } from "../types";
import { runSourcing } from "../sourcing/run";
import { rulesScore, type Candidate } from "../sourcing/score";
import { TregProvider } from "../sourcing/treg";
import { planSearch, seniorityOf } from "../sourcing/vocabulary";
import type {
  CallOptions, Company, FoundPerson, Priced, Signal, SourcingProvider,
} from "../sourcing/provider";

const SALES: Brief = {
  goalType: "sales", targetRoles: [], seniority: ["قيادي"], industries: ["تأمين"],
  geos: ["السعودية"], inclusions: [], exclusions: [], summaryAr: "بركز على أصحاب القرار في التأمين.",
  confidence: 0.6, extractedBy: "rules",
};

const recent = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** An in-memory provider that records every call and charges a fixed price. */
class FakeProvider implements SourcingProvider {
  calls: { tool: string; options: CallOptions; query: unknown }[] = [];
  constructor(private price = 1_000, private failPeopleFor = new Set<string>()) {}

  async findCompanies(query: unknown, options: CallOptions): Promise<Priced<Company[]>> {
    this.calls.push({ tool: "companies", options, query });
    return {
      costMicro: this.price,
      value: [
        { name: "Tawuniya", domain: "tawuniya.com", industry: "Insurance" },
        { name: "Malath", domain: "malath.com.sa", industry: "Insurance" },
      ],
    };
  }

  async findPeople(
    query: { companyDomain: string }, options: CallOptions,
  ): Promise<Priced<FoundPerson[]>> {
    this.calls.push({ tool: "people", options, query });
    if (this.failPeopleFor.has(query.companyDomain)) throw new Error("upstream 503");
    const who = query.companyDomain === "tawuniya.com" ? "Othman" : "Sara";
    return {
      costMicro: this.price,
      value: [
        { name: `${who} CEO`, title: "Chief Executive Officer", company: "", companyDomain: query.companyDomain,
          profileUrl: `https://www.linkedin.com/in/${who.toLowerCase()}-ceo`, servedBy: "fake" },
        { name: `${who} Analyst`, title: "Data Analyst", company: "", companyDomain: query.companyDomain,
          profileUrl: `https://www.linkedin.com/in/${who.toLowerCase()}-analyst`, servedBy: "fake" },
      ],
    };
  }

  async findSignals(query: { q: string }, options: CallOptions): Promise<Priced<Signal[]>> {
    this.calls.push({ tool: "signals", options, query });
    return {
      costMicro: this.price,
      value: [
        { url: `https://news.example/${encodeURIComponent(query.q)}`, title: "Board change", source: "news.example", date: recent(10) },
        { url: "https://news.example/old", title: "Old news", source: "news.example", date: "2019-01-01" },
      ],
    };
  }
}

describe("search plan", () => {
  it("maps Arabic sectors and roles to provider terms", () => {
    expect(planSearch(SALES, "")).toMatchObject({ industries: ["Insurance"], titles: ["Chief"] });
    const job = planSearch({ ...SALES, goalType: "job", targetRoles: ["مدير منتج فأعلى"], industries: ["تقنية مالية"] }, "");
    expect(job).toMatchObject({ industries: ["Financial Services"], titles: ["Product"] });
  });

  it("falls back to the raw text when the brief names no sector", () => {
    expect(planSearch({ ...SALES, industries: [] }, "أبيع للبنوك").industries).toEqual(["Banking"]);
  });

  it("reads seniority from English titles", () => {
    expect(seniorityOf("Chief Executive Officer")).toBe("cxo");
    expect(seniorityOf("Head of Product")).toBe("head");
    expect(seniorityOf("Data Analyst")).toBe("other");
  });
});

describe("runSourcing", () => {
  const input = { requestId: "r1", brief: SALES, rawText: "أبيع لشركات التأمين", sectors: [] };

  it("keeps decision makers, drops the rest, and cites only fetched URLs", async () => {
    const provider = new FakeProvider();
    const result = await runSourcing(input, { provider });

    const titles = result.candidates.map((c) => c.person.title);
    expect(titles).toEqual(["Chief Executive Officer", "Chief Executive Officer"]);
    expect(result.items).toHaveLength(2);

    const fetched = new Set(result.candidates.flatMap((c) => [
      c.person.profileUrl, ...c.signals.map((s) => s.url),
    ]));
    for (const item of result.items) {
      expect(item.evidence.length).toBeGreaterThan(0);
      for (const e of item.evidence) expect(fetched.has(e.url)).toBe(true);
    }
    // A signal older than a year is not evidence of "why now".
    expect(result.items.flatMap((i) => i.evidence).some((e) => e.url.endsWith("/old"))).toBe(false);
    expect(result.spentMicro).toBe(5_000); // 1 company search + 2 people + 2 signals
  });

  it("namespaces idempotency keys by request and caps every call at the budget left", async () => {
    const provider = new FakeProvider();
    await runSourcing(input, { provider, budgetMicro: 3_500 });
    expect(provider.calls[0].options.idempotencyKey).toBe("r1:companies-0");
    expect(provider.calls.map((c) => c.options.maxCostUsd)).toEqual([0.0035, 0.0025, 0.0015, 0.0005]);
  });

  it("stops at the budget instead of overspending, and says so", async () => {
    const provider = new FakeProvider(1_000);
    const result = await runSourcing(input, { provider, budgetMicro: 2_000 });
    expect(result.spentMicro).toBe(2_000);
    expect(provider.calls).toHaveLength(2);
    expect(result.note).toContain("الميزانية");
  });

  it("survives one company failing", async () => {
    const provider = new FakeProvider(1_000, new Set(["tawuniya.com"]));
    const result = await runSourcing(input, { provider });
    expect(result.candidates.map((c) => c.company.domain)).toEqual(["malath.com.sa"]);
    expect(result.note).toBeDefined();
  });

  it("replays a stored step instead of calling the provider again", async () => {
    const stored = new Map<string, unknown>();
    const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      if (!stored.has(name)) stored.set(name, await fn());
      return stored.get(name) as T;
    };
    const first = new FakeProvider();
    const a = await runSourcing(input, { provider: first }, step);
    const second = new FakeProvider();
    const b = await runSourcing(input, { provider: second }, step);
    expect(second.calls).toHaveLength(0);
    expect(b.spentMicro).toBe(a.spentMicro);
  });
});

describe("rules scoring", () => {
  const candidate = (signals: Signal[]): Candidate => ({
    key: "k", company: { name: "Tawuniya", domain: "tawuniya.com" }, signals,
    person: { name: "Othman A", title: "Chief Executive Officer", company: "Tawuniya",
      companyDomain: "tawuniya.com", profileUrl: "https://www.linkedin.com/in/o", servedBy: "fake" },
  });

  it("only calls a match strong when there is a recent dated signal", () => {
    const plan = planSearch(SALES, "");
    expect(rulesScore(SALES, plan, [candidate([])])[0].fit).not.toBe("strong");
    const live = rulesScore(SALES, plan, [candidate([{ url: "https://n/1", title: "x", source: "n", date: recent(5) }])]);
    expect(live[0].fit).toBe("strong");
    expect(live[0].opener.startsWith("هلا Othman")).toBe(true);
  });
});

describe("TregProvider", () => {
  it("sends the budget and idempotency headers and reads the charge from the header", async () => {
    const seen: Request[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      seen.push(new Request(url, init));
      return new Response(JSON.stringify({
        output: { companies: [
          { name: "Tawuniya", website_url: "https://www.tawuniya.com/en", country: "SA", industry: "Insurance" },
          { name: "Elsewhere", website_url: "x.ae", country: "AE" },
          { name: "No domain", country: "SA" },
        ] },
        _treg: { served_by: "tomba" },
      }), { headers: { "x-treg-cost-micro": "178" } });
    }) as unknown as typeof fetch;

    const provider = new TregProvider("tok", fetcher);
    const r = await provider.findCompanies(
      { industry: "Insurance", country: "SA", limit: 25 },
      { maxCostUsd: 0.05, idempotencyKey: "r1:companies-0" },
    );

    expect(r.costMicro).toBe(178);
    expect(r.value).toEqual([{ name: "Tawuniya", domain: "tawuniya.com", industry: "Insurance", size: undefined, linkedinUrl: undefined }]);
    expect(seen[0].url).toBe("https://treg.to/call/treg.companies.search");
    expect(seen[0].headers.get("x-treg-token")).toBe("tok");
    expect(seen[0].headers.get("x-treg-route-max-cost")).toBe("0.0500");
    expect(seen[0].headers.get("idempotency-key")).toBe("r1:companies-0");
  });

  it("does not swallow a provider error", async () => {
    const fetcher = (async () => new Response("bad", { status: 422 })) as unknown as typeof fetch;
    await expect(new TregProvider("t", fetcher).findSignals(
      { q: "x", limit: 1 }, { maxCostUsd: 0.01, idempotencyKey: "k" },
    )).rejects.toThrow(/422/);
  });
});

describe("writing a sourced pipeline", () => {
  let db: Database;
  let requestId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "s@x.sa", name: "s" }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: "سارة", initial: "S", email: "s@x.sa", state: "verified",
    }).returning();
    requestId = await repo.createRequest({ accountId: account.id, rawText: "أبيع للتأمين", brief: SALES, slaHours: 24 }, db);
  });

  async function sourced() {
    const result = await runSourcing(
      { requestId, brief: SALES, rawText: "أبيع للتأمين", sectors: [] },
      { provider: new FakeProvider() },
    );
    const used = new Set(result.items.map((i) => i.candidateKey));
    return {
      requestId,
      people: result.candidates.filter((c) => used.has(c.key)).map((c) => ({
        key: c.key, name: c.person.name, title: c.person.title, company: c.company.name,
        companyDomain: c.company.domain, industries: ["Insurance"], seniority: seniorityOf(c.person.title),
        linkedinUrl: c.person.profileUrl, servedBy: c.person.servedBy,
      })),
      rows: result.items,
      spentMicro: result.spentMicro,
      createdBy: "AI",
    };
  }

  it("confirms into in_sourcing without a pipeline, and re-confirming is safe", async () => {
    expect(await repo.confirmBriefForSourcing(requestId, undefined, db)).toBe(true);
    const [r] = await db.select().from(requests).where(eq(requests.id, requestId));
    expect(r.status).toBe("in_sourcing");
    expect(r.workflowId).toBe(requestId);
    expect(await db.select().from(pipelines)).toHaveLength(0);
    // Still no pipeline → the action may start the (idempotent) workflow again.
    expect(await repo.confirmBriefForSourcing(requestId, undefined, db)).toBe(true);
  });

  it("writes people, v1 and its rows once, and records the spend", async () => {
    await repo.confirmBriefForSourcing(requestId, undefined, db);
    const input = await sourced();
    const id = await repo.writeSourcedPipeline(input, db);
    expect(await repo.writeSourcedPipeline(input, db)).toBe(id);

    const items = await db.select().from(pipelineItems).where(eq(pipelineItems.pipelineId, id!));
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.evidence.length > 0)).toBe(true);
    const rows = await db.select().from(people);
    expect(rows.every((p) => p.source === "provider" && p.servedBy === "fake")).toBe(true);
    const [r] = await db.select().from(requests).where(eq(requests.id, requestId));
    expect(r.sourcingCostMicro).toBe(input.spentMicro);
    expect(await repo.confirmBriefForSourcing(requestId, undefined, db)).toBe(false);
  });

  it("reuses a person another request already found", async () => {
    const input = await sourced();
    await repo.writeSourcedPipeline(input, db);
    const before = await db.select().from(people);

    const [account] = await db.select().from(accounts).limit(1);
    const otherId = await repo.createRequest({ accountId: account.id, rawText: "x", brief: SALES, slaHours: 24 }, db);
    await repo.writeSourcedPipeline({ ...input, requestId: otherId }, db);
    expect(await db.select().from(people)).toHaveLength(before.length);
  });
});

describe("signal relevance", () => {
  const company = { name: "Tawuniya", domain: "tawuniya.com" };
  const sig = (title: string, source = "argaam.com", snippet = "") => ({ url: "https://x", title, source, snippet });

  it("keeps dated news that names the company and drops quote and index pages", async () => {
    const { aboutCompany } = await import("../sourcing/run");
    expect(aboutCompany(sig("Tawuniya inks deal to boost Saudization"), company)).toBe(true);
    expect(aboutCompany(sig("Press Releases & Events", "tawuniya.com", "Tawuniya news"), company)).toBe(false);
    expect(aboutCompany(sig("Tawuniya (SASE:8010) Stock Price", "simplywall.st"), company)).toBe(false);
    expect(aboutCompany(sig("Tawuniya"), company)).toBe(false);
    expect(aboutCompany(sig("Bupa wins contract"), company)).toBe(false);
  });
});
