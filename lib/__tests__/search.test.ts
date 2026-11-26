import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reset, testDb } from "../db/testing";
import * as repo from "../db/repo";
import { accounts, authUsers, leads, ledger, pipelineItems, pipelines, searchLog } from "../db/schema";
import type { Database } from "../db";
import type { Brief } from "../types";
import { DAILY_SEARCHES, SearchError, searchCompanies, searchPeople } from "../search/service";
import { openerFor } from "../search/opener";
import { verdictOf } from "../sourcing/treg";
import { presetHref } from "../search/presets";

describe("search, leads and reveals", () => {
  let db: Database;
  let accountId: string;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "s@lumen.sa", name: "s" }).returning();
    const [account] = await db.insert(accounts).values({
      userId: user.id, displayName: "Sara", initial: "S", email: "s@lumen.sa", state: "observer",
    }).returning();
    accountId = account.id;
  });

  const person = { name: "Faisal Alotaibi", title: "Chief Digital Officer", company: "Qimma", companyDomain: "qimma.example", linkedinUrl: "https://www.linkedin.com/in/faisal", seniority: "cxo" };

  it("searches through the offline provider and logs every search", async () => {
    await repo.grantWelcomeCredits(accountId, db);
    const companies = await searchCompanies(accountId, { sector: "Insurance", market: "SA" });
    expect(companies.length).toBeGreaterThan(0);
    const people = await searchPeople(accountId, { companyDomain: companies[0].domain, title: "Chief", market: "SA" });
    expect(people[0].leader).toBe(true); // decision makers first
    const logged = await db.select().from(searchLog).where(eq(searchLog.accountId, accountId));
    expect(logged.map((l) => l.kind)).toEqual(["companies", "people"]);
  });

  it("refuses a search with nothing to search for", async () => {
    await expect(searchCompanies(accountId, { market: "SA" })).rejects.toBeInstanceOf(SearchError);
  });

  it("stops at the daily search limit", async () => {
    for (let i = 0; i < DAILY_SEARCHES; i++) {
      await repo.logSearch({ accountId, kind: "companies", query: {}, results: 0, costMicro: 0 }, db);
    }
    await expect(searchCompanies(accountId, { sector: "Insurance", market: "SA" })).rejects.toMatchObject({ code: "budget" });
  });

  it("saves a lead once per person, reusing the person across accounts", async () => {
    const a = await repo.saveLead({ accountId, person }, db);
    expect(await repo.saveLead({ accountId, person }, db)).toBe(a);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("gives welcome credits once", async () => {
    await repo.grantWelcomeCredits(accountId, db);
    await repo.grantWelcomeCredits(accountId, db);
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS);
  });

  it("charges a reveal once, refunds a miss, and refuses with no credit", async () => {
    const leadId = await repo.saveLead({ accountId, person }, db);
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));

    expect(await repo.reserveReveal({ accountId, personId: lead.personId }, db)).toEqual({ ok: false, reason: "insufficient_credits" });

    await repo.grantWelcomeCredits(accountId, db);
    expect(await repo.reserveReveal({ accountId, personId: lead.personId }, db)).toEqual({ ok: true, charged: true });
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS - 1);
    // Revealing the same person again is free.
    expect(await repo.reserveReveal({ accountId, personId: lead.personId }, db)).toEqual({ ok: true, charged: false });

    await repo.recordReveal({ accountId, leadId, personId: lead.personId, email: null, status: "not_found" }, db);
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS);
    const rows = await db.select().from(ledger).where(eq(ledger.accountId, accountId));
    expect(rows.map((r) => r.reason).sort()).toEqual(["grant", "refund_reveal", "reveal"]);
  });

  it("keeps a found email on the lead and the person", async () => {
    await repo.grantWelcomeCredits(accountId, db);
    const leadId = await repo.saveLead({ accountId, person }, db);
    const lead = (await repo.getLead(accountId, leadId, db))!;
    await repo.reserveReveal({ accountId, personId: lead.personId }, db);
    await repo.recordReveal({ accountId, leadId, personId: lead.personId, email: "faisal@qimma.example", status: "valid" }, db);
    const after = (await repo.getLead(accountId, leadId, db))!;
    expect(after.email).toBe("faisal@qimma.example");
    expect(after.person.emailVerified).toBe(true);
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS - 1);
  });

  it("auto-publishes only evidence-backed rows", async () => {
    const brief: Brief = { goalType: "sales", targetRoles: [], seniority: [], industries: ["تأمين"], geos: [], inclusions: [], exclusions: [], summaryAr: "x", confidence: 0.5, extractedBy: "rules" };
    const requestId = await repo.createRequest({ accountId, rawText: "x", brief, slaHours: 24 }, db);
    await repo.confirmBriefForSourcing(requestId, undefined, db);
    const backed = await repo.saveLead({ accountId, person }, db); // ensures a person row exists
    const [{ personId }] = await db.select({ personId: leads.personId }).from(leads).where(eq(leads.id, backed));
    const pipelineId = await repo.writeSourcedPipeline({
      requestId, spentMicro: 0, createdBy: "AI", people: [],
      rows: [
        { candidateKey: "x", rank: 1, fit: "strong", thin: false, why: "w", whyNow: "n", roleRelevance: "", companyRelevance: "", timing: "", leadWith: "", avoid: "", opener: "o", channel: "linkedin", status: "proposed", evidence: [{ url: "https://e", title: "t", source: "s", date: "", assertedBy: "ai" }], generatedBy: "ai" },
      ],
    }, db);
    // writeSourcedPipeline skips rows whose person it didn't write; add one directly.
    await db.insert(pipelineItems).values({ pipelineId: pipelineId!, personId, rank: 1, fit: "strong", thin: false, why: "w", whyNow: "n", roleRelevance: "", companyRelevance: "", timing: "", leadWith: "", avoid: "", opener: "o", channel: "linkedin", status: "proposed", evidence: [{ url: "https://e", title: "t", source: "s", date: "", assertedBy: "ai" }], generatedBy: "ai" });
    expect(await repo.autoPublish(pipelineId!, "AI", db)).toBe(requestId);
    const [p] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId!));
    expect(p.status).toBe("published");
  });
});

describe("credits for searches", () => {
  let db: Database;
  let accountId: string;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "c@x.sa", name: "c" }).returning();
    const [account] = await db.insert(accounts).values({ userId: user.id, displayName: "C", initial: "C", email: "c@x.sa", state: "observer" }).returning();
    accountId = account.id;
  });

  it("refuses a search at zero credits, before calling any provider", async () => {
    await expect(searchCompanies(accountId, { sector: "Insurance", market: "SA" })).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(await db.select().from(searchLog)).toHaveLength(0);
  });

  it("charges one credit per search that finds something", async () => {
    await repo.grantWelcomeCredits(accountId, db);
    await searchCompanies(accountId, { sector: "Insurance", market: "SA" });
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS - 1);
  });

  it("refunds a search's credit when the refund is recorded", async () => {
    await repo.grantWelcomeCredits(accountId, db);
    await repo.reserveCredit({ accountId, reason: "search", ref: "search:x" }, db);
    await repo.refundSearch(accountId, "search:x", db);
    await repo.refundSearch(accountId, "search:x", db); // a second refund is absorbed
    expect(await repo.creditBalance(accountId, db)).toBe(repo.WELCOME_CREDITS);
  });
});

describe("credit orders", () => {
  let db: Database;
  let accountId: string;
  beforeEach(async () => {
    db = await testDb();
    await reset(db);
    const [user] = await db.insert(authUsers).values({ email: "b@x.sa", name: "b" }).returning();
    const [account] = await db.insert(accounts).values({ userId: user.id, displayName: "B", initial: "B", email: "b@x.sa", state: "observer" }).returning();
    accountId = account.id;
  });

  const invoiceId = "11111111-2222-3333-4444-555555555555";

  it("grants a paid order's credits exactly once", async () => {
    const orderId = await repo.createOrder({ accountId, package: "starter", credits: 100, amountHalalas: 9900 }, db);
    await repo.attachInvoice(orderId, invoiceId, db);
    const order = (await repo.getOrder(orderId, db))!;
    const paid = { id: invoiceId, status: "paid", amount: 9900, currency: "SAR" };
    expect(await repo.settleOrder(order, paid, db)).toBe("paid");
    expect(await repo.settleOrder((await repo.getOrder(orderId, db))!, paid, db)).toBe("paid");
    expect(await repo.creditBalance(accountId, db)).toBe(100);
  });

  it("refuses a paid invoice for a different amount or invoice", async () => {
    const orderId = await repo.createOrder({ accountId, package: "starter", credits: 100, amountHalalas: 9900 }, db);
    await repo.attachInvoice(orderId, invoiceId, db);
    const order = (await repo.getOrder(orderId, db))!;
    expect(await repo.settleOrder(order, { id: invoiceId, status: "paid", amount: 100, currency: "SAR" }, db)).toBe("failed");
    expect(await repo.settleOrder(order, { id: "other", status: "paid", amount: 9900, currency: "SAR" }, db)).toBe("failed");
    expect(await repo.creditBalance(accountId, db)).toBe(0);
  });

  it("marks expired invoices and leaves pending ones pending", async () => {
    const orderId = await repo.createOrder({ accountId, package: "starter", credits: 100, amountHalalas: 9900 }, db);
    await repo.attachInvoice(orderId, invoiceId, db);
    const order = (await repo.getOrder(orderId, db))!;
    expect(await repo.settleOrder(order, { id: invoiceId, status: "initiated", amount: 9900, currency: "SAR" }, db)).toBe("pending");
    expect(await repo.settleOrder(order, { id: invoiceId, status: "expired", amount: 9900, currency: "SAR" }, db)).toBe("failed");
    expect((await repo.getOrder(orderId, db))!.status).toBe("expired");
  });
});

describe("helpers", () => {
  it("folds treg verdicts", () => {
    expect(verdictOf({ verdict: "valid" })).toBe("valid");
    expect(verdictOf({ verdict: "invalid" })).toBe("invalid");
    expect(verdictOf({ verdict: "accept_all" })).toBe("risky");
    expect(verdictOf(undefined)).toBe("risky");
  });

  it("writes openers in the account's language and goal", () => {
    const me = { displayName: "Sara", company: "Lumen", useCase: "invest" } as never;
    expect(openerFor({ lang: "en", name: "Tariq Alfaisal", company: "Thuraya", signal: "Fund II", me })).toContain("Hi Tariq");
    expect(openerFor({ lang: "ar", name: "Tariq Alfaisal", company: "Thuraya", me })).toContain("هلا Tariq");
  });

  it("builds preset links that run on arrival", () => {
    const href = presetHref("sell", "ar");
    expect(href).toContain("mode=companies");
    expect(href).toContain("sector=Insurance");
    expect(href).toContain("run=1");
    expect(href).toContain("lang=ar");
  });
});
