import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { apiCallLog } from "./db/schema";

/**
 * Coresignal — the only place vendor calls happen, and the only place that
 * knows what one costs.
 *
 * Server-side only (`server-only` above): `CORESIGNAL_API_KEY` buys real
 * credits, so it must never be reachable from a bundle a browser can read, and
 * no raw vendor payload should reach a client either.
 *
 * ── The credit posture, which is the reason this file is not three fetches ──
 *
 * Search is free and collect is not. The search endpoints return **arrays of
 * ids** and an `x-total-results` header for nothing; turning one of those ids
 * into a person with an email address costs 20 credits. So the shape of every
 * sourcing flow is: narrow for free until the set is small and right, then buy
 * only what survives.
 *
 * Two mechanisms hold that line:
 *
 *   • **`argsHash`.** Every paid call is keyed by (provider, endpoint, hash of
 *     its arguments) under a unique index, so the same lookup is bought once
 *     and every later caller is served the stored response. A retry that lost
 *     its result costs nothing; a loop that asks for the same employee twice
 *     costs nothing.
 *   • **`apiCallLog`.** Every call — free ones included — records what it cost
 *     and the `x-credits-remaining` the vendor reported. Our own arithmetic is
 *     an estimate; that header is the truth, and /am/ops shows both.
 *
 * Verified against the live API (free calls only): Saudi companies with 50+
 * employees = 8,092; of those with an active job posting = 620; employees at a
 * single company id = 78; "Business Development" titles in Saudi = 24,718.
 */

export const CORESIGNAL_BASE = "https://api.coresignal.com/cdapi/v2";
export const PROVIDER = "coresignal";

/**
 * What each endpoint costs, in vendor credits.
 *
 * Zero means genuinely free — confirmed by `x-credits-remaining` not moving
 * across a call. The three search endpoints are the free ones, and they are
 * where the work belongs.
 */
export const CREDIT_COST = {
  "company_base/search/filter": 0,
  "company_multi_source/search/es_dsl": 0,
  "employee_multi_source/search/es_dsl": 0,
  "company_clean/collect": 10,
  "company_multi_source/enrich": 20,
  /** The ONLY source of primary_professional_email. */
  "employee_multi_source/collect": 20,
  "jobs/record": 1,
  "posts/record": 1,
} as const;

export type Endpoint = keyof typeof CREDIT_COST;

/**
 * How the vendor arrived at an address, and therefore how far it may be
 * trusted. Only `verified` means the mailbox was checked; the rest are
 * inference, and `guessed_common_pattern` is a guess in the literal sense.
 *
 * This matters more here than it would elsewhere: intro.sa sends to people who
 * never asked to hear from us, so a bounce is not an inconvenience, it is
 * reputation damage on a domain that also carries our login mail. See
 * docs/sending-domains.md.
 */
export type EmailStatus =
  | "verified"
  | "matched_email"
  | "matched_pattern"
  | "guessed_common_pattern";

export const EMAIL_STATUSES: readonly EmailStatus[] = [
  "verified",
  "matched_email",
  "matched_pattern",
  "guessed_common_pattern",
];

/** Only the fields we actually read; the vendor returns a great deal more. */
export interface EmployeeRecord {
  id: number;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  location_country?: string | null;
  active_experience_title?: string | null;
  active_experience_company_name?: string | null;
  primary_professional_email?: string | null;
  primary_professional_email_status?: EmailStatus | null;
}

export interface CompanyRecord {
  id: number;
  company_name?: string | null;
  website?: string | null;
  employees_count?: number | null;
  hq_country?: string | null;
  industry?: string | null;
  linkedin_url?: string | null;
}

export interface SearchResult {
  /** Ids only — turning one into a record is what costs credits. */
  ids: number[];
  /** `x-total-results`: the size of the whole match, not of this page. */
  total: number | null;
  creditsRemaining: number | null;
}

export interface PaidResult<T> {
  data: T | null;
  /** True when this was served from `apiCallLog` and cost nothing. */
  cached: boolean;
  creditsSpent: number;
  creditsRemaining: number | null;
}

export class CoresignalError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: Endpoint,
    body: string,
  ) {
    super(`coresignal ${endpoint} failed: ${status} ${body.slice(0, 200)}`);
    this.name = "CoresignalError";
  }
}

export class CoresignalNotConfiguredError extends Error {
  constructor() {
    super("CORESIGNAL_API_KEY is not set — vendor lookups are disabled.");
    this.name = "CoresignalNotConfiguredError";
  }
}

export interface ClientOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  database?: Database;
  /**
   * The account whose work causes the spend. Recorded on every paid row, so
   * "who burned the credits" is answerable without guessing from timestamps.
   */
  accountId?: string;
}

/**
 * A stable hash of a call's arguments.
 *
 * Keys are sorted recursively so `{a,b}` and `{b,a}` are the same call — an
 * es_dsl query built by different code paths must not buy the same page twice
 * because a serializer chose a different key order.
 */
export function argsHash(endpoint: Endpoint, args: unknown): string {
  return createHash("sha256").update(`${endpoint}:${canonical(args)}`).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

function creditsHeader(response: Response): number | null {
  const raw = response.headers.get("x-credits-remaining");
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function totalHeader(response: Response): number | null {
  const value = Number.parseInt(response.headers.get("x-total-results") ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

export interface Coresignal {
  /** FREE. Structured company filter — Saudi, size, industry, and so on. */
  searchCompanies(filter: Record<string, unknown>): Promise<SearchResult>;
  /** FREE. Elasticsearch DSL over the multi-source company index. */
  searchCompaniesEsDsl(query: Record<string, unknown>): Promise<SearchResult>;
  /** FREE. Elasticsearch DSL over the multi-source employee index. */
  searchEmployeesEsDsl(query: Record<string, unknown>): Promise<SearchResult>;
  /** 10 credits. */
  collectCompany(id: number): Promise<PaidResult<CompanyRecord>>;
  /** 20 credits. Keyed on the website, which is how the vendor resolves it. */
  enrichCompanyByWebsite(website: string): Promise<PaidResult<CompanyRecord>>;
  /** 20 credits, and the only way to an email address. */
  collectEmployee(id: number): Promise<PaidResult<EmployeeRecord>>;
  /** The last balance the vendor reported. Costs nothing — it is a read. */
  creditsRemaining(): Promise<number | null>;
}

export function createCoresignal(options: ClientOptions = {}): Coresignal {
  const database = options.database ?? defaultDb;
  const doFetch = options.fetchImpl ?? fetch;
  const accountId = options.accountId;

  function apiKey(): string {
    const key = options.apiKey ?? process.env.CORESIGNAL_API_KEY;
    if (!key) throw new CoresignalNotConfiguredError();
    return key;
  }

  async function call(
    endpoint: Endpoint,
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: unknown; creditsRemaining: number | null; total: number | null }> {
    const response = await doFetch(`${CORESIGNAL_BASE}${path}`, {
      ...init,
      headers: {
        // The vendor's own header name; not Authorization, not Bearer.
        apikey: apiKey(),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });

    const creditsRemaining = creditsHeader(response);
    const total = totalHeader(response);
    if (response.status === 404) return { status: 404, body: null, creditsRemaining, total };
    if (!response.ok) {
      throw new CoresignalError(response.status, endpoint, await response.text().catch(() => ""));
    }
    return { status: response.status, body: await response.json(), creditsRemaining, total };
  }

  /**
   * A free call: run it, record what it observed, return the ids.
   *
   * Logged like any other call so the ops page can see search volume, but with
   * `creditsSpent: 0`, which is also what keeps it outside the dedupe guard —
   * the unique index is partial on `credits_spent > 0`, because a search is
   * meant to be repeatable and a purchase is not.
   */
  async function search(
    endpoint: Endpoint,
    path: string,
    body: Record<string, unknown>,
  ): Promise<SearchResult> {
    const result = await call(endpoint, path, { method: "POST", body: JSON.stringify(body) });
    const ids = Array.isArray(result.body)
      ? (result.body as unknown[]).filter((v): v is number => typeof v === "number")
      : [];

    await record({
      endpoint,
      hash: argsHash(endpoint, body),
      creditsSpent: 0,
      creditsRemaining: result.creditsRemaining,
      response: null,
    });

    return { ids, total: result.total, creditsRemaining: result.creditsRemaining };
  }

  /**
   * A paid call, bought at most once.
   *
   * The stored row is checked first; a hit returns the payload with
   * `creditsSpent: 0`. On a miss the call is made and the row is written with
   * `onConflictDoNothing`, so two concurrent callers cost one purchase and the
   * loser's write is simply dropped rather than raising.
   */
  async function paid<T>(
    endpoint: Endpoint,
    path: string,
    args: Record<string, unknown>,
  ): Promise<PaidResult<T>> {
    const hash = argsHash(endpoint, args);

    const [existing] = await database
      .select()
      .from(apiCallLog)
      .where(
        and(
          eq(apiCallLog.provider, PROVIDER),
          eq(apiCallLog.endpoint, endpoint),
          eq(apiCallLog.argsHash, hash),
          sql`${apiCallLog.creditsSpent} > 0`,
        ),
      )
      .limit(1);
    if (existing) {
      return {
        data: (existing.response as T | null) ?? null,
        cached: true,
        creditsSpent: 0,
        creditsRemaining: existing.creditsRemaining,
      };
    }

    const result = await call(endpoint, path, { method: "GET" });

    // A 404 buys nothing and is worth remembering: asking the vendor again for
    // an id it does not have would cost the same nothing every time, but the
    // caller would keep waiting for it.
    const creditsSpent = result.status === 404 ? 0 : CREDIT_COST[endpoint];

    await record({
      endpoint,
      hash,
      creditsSpent,
      creditsRemaining: result.creditsRemaining,
      response: (result.body ?? null) as Record<string, unknown> | null,
    });

    return {
      data: (result.body as T | null) ?? null,
      cached: false,
      creditsSpent,
      creditsRemaining: result.creditsRemaining,
    };
  }

  /** Logging a call must never be the reason a lookup fails. */
  async function record(entry: {
    endpoint: Endpoint;
    hash: string;
    creditsSpent: number;
    creditsRemaining: number | null;
    response: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await database
        .insert(apiCallLog)
        .values({
          provider: PROVIDER,
          endpoint: entry.endpoint,
          argsHash: entry.hash,
          creditsSpent: entry.creditsSpent,
          creditsRemaining: entry.creditsRemaining,
          accountId,
          response: entry.response,
        })
        .onConflictDoNothing();
    } catch (error) {
      console.warn("[coresignal] failed to log an API call", error);
    }
  }

  return {
    searchCompanies: (filter) =>
      search("company_base/search/filter", "/company_base/search/filter", filter),
    searchCompaniesEsDsl: (query) =>
      search("company_multi_source/search/es_dsl", "/company_multi_source/search/es_dsl", query),
    searchEmployeesEsDsl: (query) =>
      search("employee_multi_source/search/es_dsl", "/employee_multi_source/search/es_dsl", query),

    collectCompany: (id) =>
      paid<CompanyRecord>("company_clean/collect", `/company_clean/collect/${id}`, { id }),

    enrichCompanyByWebsite: (website) =>
      paid<CompanyRecord>(
        "company_multi_source/enrich",
        `/company_multi_source/enrich?website=${encodeURIComponent(website)}`,
        { website: website.trim().toLowerCase() },
      ),

    collectEmployee: (id) =>
      paid<EmployeeRecord>(
        "employee_multi_source/collect",
        `/employee_multi_source/collect/${id}`,
        { id },
      ),

    creditsRemaining: () => creditsRemaining(database),
  };
}

/**
 * The last balance the vendor reported, from `apiCallLog`.
 *
 * Read from our own records rather than asked for: there is no free "how many
 * credits do I have" endpoint, so the honest answer is the most recent
 * `x-credits-remaining` we saw, with the time we saw it.
 */
export async function creditsRemaining(database: Database = defaultDb): Promise<number | null> {
  const [row] = await database
    .select({ remaining: apiCallLog.creditsRemaining })
    .from(apiCallLog)
    .where(and(eq(apiCallLog.provider, PROVIDER), isNotNull(apiCallLog.creditsRemaining)))
    .orderBy(desc(apiCallLog.at))
    .limit(1);
  return row?.remaining ?? null;
}

export interface SpendSummary {
  calls: number;
  paidCalls: number;
  creditsSpent: number;
}

/** What the vendor cost us since `since`. Drives the /am/ops figures. */
export async function spendSince(
  since: Date,
  database: Database = defaultDb,
): Promise<SpendSummary> {
  const [row] = await database
    .select({
      calls: sql<number>`count(*)::int`,
      paidCalls: sql<number>`count(*) filter (where ${apiCallLog.creditsSpent} > 0)::int`,
      creditsSpent: sql<number>`coalesce(sum(${apiCallLog.creditsSpent}), 0)::int`,
    })
    .from(apiCallLog)
    .where(and(eq(apiCallLog.provider, PROVIDER), gte(apiCallLog.at, since.toISOString())));
  return {
    calls: Number(row?.calls ?? 0),
    paidCalls: Number(row?.paidCalls ?? 0),
    creditsSpent: Number(row?.creditsSpent ?? 0),
  };
}
