import { beforeEach, describe, expect, it, vi } from "vitest";
import { reset, testDb } from "../db/testing";
import { apiCallLog } from "../db/schema";
import {
  argsHash,
  CREDIT_COST,
  createCoresignal,
  creditsRemaining,
  spendSince,
  type EmployeeRecord,
} from "../coresignal";
import type { Database } from "../db";

/**
 * The Coresignal client, against fixtures. Zero live calls and zero credits:
 * every response here is a stub, which is also the only way to assert what a
 * call *would* have cost.
 *
 * The two properties that matter are the two that cost money if they break —
 * the log records the right number of credits against the right account, and
 * an identical paid call is never bought twice.
 */

const KEY = "test-key-not-a-real-one";

/** A response with the two headers the vendor actually sends. */
function reply(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

const EMPLOYEE: EmployeeRecord = {
  id: 4242,
  full_name: "Noura A.",
  active_experience_title: "Head of Product",
  active_experience_company_name: "Example",
  primary_professional_email: "noura@example.sa",
  primary_professional_email_status: "verified",
};

describe("coresignal client", () => {
  let db: Database;

  beforeEach(async () => {
    db = await testDb();
    await reset(db);
  });

  const rows = () => db.select().from(apiCallLog);

  describe("free search", () => {
    it("returns ids and x-total-results, and records a zero-credit call", async () => {
      const fetchImpl = vi.fn(async () =>
        reply([1, 2, 3], { "x-total-results": "8092", "x-credits-remaining": "1000" }),
      );
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      const result = await api.searchCompanies({ country: "Saudi Arabia", employees_count_gte: 50 });

      expect(result.ids).toEqual([1, 2, 3]);
      expect(result.total).toBe(8092);
      expect(result.creditsRemaining).toBe(1000);

      const [row] = await rows();
      expect(row.creditsSpent).toBe(0);
      expect(row.creditsRemaining).toBe(1000);
      expect(row.endpoint).toBe("company_base/search/filter");
    });

    /**
     * Searches change and are free, so repeating one must be allowed. That is
     * why the dedupe index is partial on `credits_spent > 0`.
     */
    it("lets an identical free search run again", async () => {
      const fetchImpl = vi.fn(async () => reply([7], { "x-credits-remaining": "1000" }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      await api.searchEmployeesEsDsl({ query: { match: { title: "Business Development" } } });
      await api.searchEmployeesEsDsl({ query: { match: { title: "Business Development" } } });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(await rows()).toHaveLength(2);
    });

    it("sends the key as the `apikey` header and never in the URL", async () => {
      const fetchImpl = vi.fn(async () => reply([]));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });
      await api.searchCompaniesEsDsl({ query: { match_all: {} } });

      const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).not.toContain(KEY);
      expect((init.headers as Record<string, string>).apikey).toBe(KEY);

      // And nothing about the key reaches the log.
      expect(JSON.stringify(await rows())).not.toContain(KEY);
    });
  });

  describe("credit accounting", () => {
    it("charges an employee collect 20 credits against the causing account", async () => {
      const account = await seedAccount(db);
      const fetchImpl = vi.fn(async () => reply(EMPLOYEE, { "x-credits-remaining": "980" }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl, accountId: account });

      const result = await api.collectEmployee(4242);

      expect(result.data?.primary_professional_email).toBe("noura@example.sa");
      expect(result.data?.primary_professional_email_status).toBe("verified");
      expect(result.creditsSpent).toBe(20);
      expect(CREDIT_COST["employee_multi_source/collect"]).toBe(20);

      const [row] = await rows();
      expect(row.creditsSpent).toBe(20);
      expect(row.creditsRemaining).toBe(980);
      expect(row.accountId).toBe(account);
    });

    it("charges a company collect 10 and an enrich 20", async () => {
      const fetchImpl = vi.fn(async () => reply({ id: 1, company_name: "Example" }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      expect((await api.collectCompany(1)).creditsSpent).toBe(10);
      expect((await api.enrichCompanyByWebsite("https://example.sa")).creditsSpent).toBe(20);

      expect(await spendSince(new Date(Date.now() - 60_000), db)).toEqual({
        calls: 2,
        paidCalls: 2,
        creditsSpent: 30,
      });
    });

    it("reports the vendor's own balance from the most recent call", async () => {
      const remaining = ["980", "960"];
      const fetchImpl = vi.fn(async () =>
        reply(EMPLOYEE, { "x-credits-remaining": remaining.shift()! }),
      );
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      await api.collectEmployee(1);
      await api.collectEmployee(2);
      expect(await creditsRemaining(db)).toBe(960);
    });

    it("charges nothing for a 404, and remembers the miss", async () => {
      const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      const result = await api.collectEmployee(9999);
      expect(result).toMatchObject({ data: null, creditsSpent: 0 });
      expect((await rows())[0].creditsSpent).toBe(0);
    });
  });

  describe("argsHash dedupe", () => {
    it("buys the same employee once, however many times it is asked for", async () => {
      const fetchImpl = vi.fn(async () => reply(EMPLOYEE, { "x-credits-remaining": "980" }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      const first = await api.collectEmployee(4242);
      const second = await api.collectEmployee(4242);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(first).toMatchObject({ cached: false, creditsSpent: 20 });
      expect(second).toMatchObject({ cached: true, creditsSpent: 0 });
      // The stored payload is served, not a stub of one.
      expect(second.data?.primary_professional_email).toBe("noura@example.sa");
      expect(await rows()).toHaveLength(1);
    });

    it("treats a different id as a different call", async () => {
      const fetchImpl = vi.fn(async () => reply(EMPLOYEE));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      await api.collectEmployee(1);
      await api.collectEmployee(2);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    /** The same website however it was typed is the same 20 credits. */
    it("normalizes the enrich key so casing does not buy it twice", async () => {
      const fetchImpl = vi.fn(async () => reply({ id: 1 }));
      const api = createCoresignal({ apiKey: KEY, database: db, fetchImpl });

      await api.enrichCompanyByWebsite("https://Example.SA");
      const again = await api.enrichCompanyByWebsite("https://example.sa ");

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(again.cached).toBe(true);
    });

    it("hashes arguments independently of key order", () => {
      const a = argsHash("employee_multi_source/search/es_dsl", { from: 0, query: { a: 1, b: 2 } });
      const b = argsHash("employee_multi_source/search/es_dsl", { query: { b: 2, a: 1 }, from: 0 });
      expect(a).toBe(b);
    });

    it("does not let one account's purchase be re-bought by another", async () => {
      const one = await seedAccount(db, "one@x.sa");
      const two = await seedAccount(db, "two@x.sa");
      const fetchImpl = vi.fn(async () => reply(EMPLOYEE));

      await createCoresignal({ apiKey: KEY, database: db, fetchImpl, accountId: one })
        .collectEmployee(4242);
      const second = await createCoresignal({ apiKey: KEY, database: db, fetchImpl, accountId: two })
        .collectEmployee(4242);

      // Deliberate: the record is bought once for the product, not once per
      // account. The row keeps the account that paid for it.
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(second.cached).toBe(true);
      expect((await rows())[0].accountId).toBe(one);
    });
  });

  it("refuses to run without a key rather than calling unauthenticated", async () => {
    vi.stubEnv("CORESIGNAL_API_KEY", "");
    const fetchImpl = vi.fn(async () => reply([]));
    const api = createCoresignal({ database: db, fetchImpl });

    await expect(api.searchCompanies({})).rejects.toThrow(/CORESIGNAL_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

async function seedAccount(db: Database, email = "f@x.sa"): Promise<string> {
  const { accounts, authUsers } = await import("../db/schema");
  const [user] = await db.insert(authUsers).values({ email }).returning();
  const [account] = await db
    .insert(accounts)
    .values({ userId: user.id, displayName: email, initial: "F", email })
    .returning();
  return account.id;
}
