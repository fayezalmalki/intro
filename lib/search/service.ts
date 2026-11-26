import { env } from "cloudflare:workers";
import * as repo from "../db/repo";
import { TregError, TregProvider, type EmailVerdict } from "../sourcing/treg";
import type { Company, FoundPerson, Priced, Signal } from "../sourcing/provider";
import { LEADERSHIP, seniorityOf } from "../sourcing/vocabulary";
import { devToolsEnabled } from "../env";
import { MARKETS, type Market } from "./markets";
import { FakeSearch } from "./fake";
import { chargeThroughGate } from "../charge";

/** One credit per search, through the account's AccountGate (no races on the last credit). */
const chargeSearch = (accountId: string, ref: string) => chargeThroughGate({ accountId, reason: "search", ref });

/**
 * Instant search (/search): companies, people, one named person, news, and an
 * email reveal — each a routed treg tool. Every call is capped per request,
 * counted against the account's daily budget, and logged with what it cost.
 */

/** Per account per UTC day: an abuse ceiling on top of credits, and a cap on our spend. */
export const DAILY_SEARCHES = 80;
export const DAILY_BUDGET_MICRO = 300_000; // $0.30
const PER_CALL_MAX_USD = 0.06;

export class SearchError extends Error {
  constructor(readonly code: "unavailable" | "budget" | "bad_query" | "upstream" | "insufficient_credits", detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
  }
}

export interface Searcher {
  findCompanies(q: { industry?: string; q?: string; name?: string; country: string; limit: number }, o: Opts): Promise<Priced<Company[]>>;
  searchPeople(q: { companyDomain?: string; title?: string; q?: string; fullName?: string; keywords?: string[]; country?: string; location?: string; limit: number }, o: Opts): Promise<Priced<FoundPerson[]>>;
  findSignals(q: { q: string; limit: number }, o: Opts): Promise<Priced<Signal[]>>;
  findEmail(q: { fullName: string; domain?: string; linkedinUrl?: string }, o: Opts): Promise<Priced<{ email: string | null; verdict: EmailVerdict; servedBy: string }>>;
}
type Opts = { maxCostUsd: number; idempotencyKey: string };

/** The live provider, or the offline one in development. Null in production without a token. */
export function searcher(): Searcher | null {
  const token = (env as unknown as { TREG_TOKEN?: string }).TREG_TOKEN;
  if (token) return new TregProvider(token);
  return devToolsEnabled ? new FakeSearch() : null;
}

/** How one search was billed — the UI says it back to the user in plain words. */
export type Billing = "charged" | "refunded" | "free" | "internal";
export interface Outcome { billing: Billing; cached: boolean }

/** How long the same question is answered from the cache, by kind. */
const TTL_HOURS: Record<string, number> = { companies: 168, people: 72, person: 72, news: 6 };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).sort().filter((k) => (value as Record<string, unknown>)[k] !== undefined && (value as Record<string, unknown>)[k] !== "")
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(typeof value === "string" ? value.trim().toLowerCase() : value);
}

/** The same question, whoever asks it: kind + the provider query, normalised. */
export async function cacheKey(kind: string, providerQuery: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(`${kind}:${stable(providerQuery)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One search. In order: the daily budget; whether this account asked the
 * same question recently (then it's free); the credit (reserved in the
 * AccountGate); a fresh cached answer, else the provider; refund if nothing
 * was found or the call failed; a log row with what it cost us and how the
 * account was billed. `trail` collects each outcome for the response.
 */
async function run<T>(
  accountId: string,
  kind: "companies" | "people" | "person" | "news" | "email",
  query: Record<string, unknown>,
  call: (s: Searcher, o: Opts) => Promise<Priced<T[]> | Priced<T>>,
  count: (v: T[] | T) => number,
  options: { charge?: boolean; providerQuery?: unknown; trail?: Outcome[] } = {},
): Promise<T[] | T> {
  const charge = options.charge ?? kind !== "email";
  const s = searcher();
  if (!s) throw new SearchError("unavailable");
  if (kind !== "email") {
    const usage = await repo.searchUsageToday(accountId);
    if (usage.count >= DAILY_SEARCHES || usage.costMicro >= DAILY_BUDGET_MICRO) throw new SearchError("budget");
  }
  const ttl = TTL_HOURS[kind];
  const key = ttl && options.providerQuery !== undefined ? await cacheKey(kind, options.providerQuery) : undefined;
  const since = ttl ? new Date(Date.now() - ttl * 3600_000).toISOString() : "";
  const repeat = charge && key ? await repo.ownRecentSearch(accountId, key, since) : false;
  const ref = `search:${crypto.randomUUID()}`;
  const paying = charge && !repeat;
  if (paying && !(await chargeSearch(accountId, ref))) throw new SearchError("insufficient_credits");

  try {
    let value: T[] | T;
    let costMicro = 0;
    let servedBy: string | undefined;
    const hit = key ? ((await repo.getCached(key)) as T[] | null) : null;
    if (hit) {
      value = hit;
      servedBy = "cache";
    } else {
      const r = await call(s, { maxCostUsd: PER_CALL_MAX_USD, idempotencyKey: `${accountId}:${kind}:${ref}` });
      value = r.value;
      costMicro = r.costMicro;
      if (key && Array.isArray(value) && value.length > 0) await repo.putCached(key, kind, value, costMicro, ttl!);
    }
    const n = count(value);
    const billing: Billing = !charge ? "internal" : repeat ? "free" : n === 0 ? "refunded" : "charged";
    if (billing === "refunded") await repo.refundSearch(accountId, ref);
    await repo.logSearch({ accountId, kind, query, results: n, costMicro, servedBy, cacheKey: key, billing, cached: Boolean(hit) });
    options.trail?.push({ billing, cached: Boolean(hit) });
    return value;
  } catch (error) {
    if (paying) await repo.refundSearch(accountId, ref);
    options.trail?.push({ billing: paying ? "refunded" : charge ? "free" : "internal", cached: false });
    if (error instanceof TregError) {
      await repo.logSearch({ accountId, kind, query: { ...query, error: error.status }, results: 0, costMicro: 0, cacheKey: key, billing: paying ? "refunded" : "internal" });
      // treg's own balance ran out: nothing the user did. Say "unavailable".
      if (/insufficient_balance|funds_required|provider_capacity/.test(error.message)) throw new SearchError("unavailable", error.message);
      // A 4xx is our request; a 402 is the per-call cap. Neither should retry elsewhere.
      throw new SearchError(error.status === 402 ? "budget" : error.status < 500 ? "bad_query" : "upstream", error.message);
    }
    throw error;
  }
}

/** What the user is told about one search action (several provider calls may be behind it). */
export function summarize(trail: Outcome[]): Outcome {
  const paid = trail.filter((o) => o.billing !== "internal");
  const last = paid.find((o) => o.billing === "charged") ?? paid.at(-1);
  return { billing: last?.billing ?? "free", cached: trail.some((o) => o.cached) };
}

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface PersonResult extends FoundPerson { seniority: string; leader: boolean }

const withSeniority = (people: FoundPerson[]): PersonResult[] =>
  people
    // Name lookups come back without titles; keep them.
    .filter((p) => p.name)
    .map((p) => ({ ...p, seniority: seniorityOf(p.title ?? ""), leader: LEADERSHIP.includes(seniorityOf(p.title ?? "")) }))
    // Decision makers first; providers return them in no particular order.
    .sort((a, b) => Number(b.leader) - Number(a.leader));

export async function searchCompanies(accountId: string, input: { sector?: string; keywords?: string; name?: string; market: Market }, trail?: Outcome[]) {
  const sector = clean(input.sector);
  const keywords = clean(input.keywords);
  const name = clean(input.name);
  if (!sector && !keywords && !name) throw new SearchError("bad_query", "a sector, keywords or a company name");
  const m = MARKETS[input.market];
  const query = name
    ? { name, country: input.market, limit: 25 }
    : sector && !keywords
      ? { industry: sector, country: input.market, limit: 25 }
      : { q: [keywords, sector && `${sector} companies`, `in ${m.location}`].filter(Boolean).join(" "), country: input.market, limit: 25 };
  const found = (await run<Company>(accountId, "companies", { ...input }, (s, o) => s.findCompanies(query, o), (v) => (v as Company[]).length, { providerQuery: query, trail })) as Company[];
  if (found.length || !("industry" in query)) return found;
  // Some sectors are filed thinly by industry; describe them instead.
  const described = { q: `${SECTOR_PHRASE[sector] ?? sector} in ${m.location}`, country: input.market, limit: 25 };
  return (await run<Company>(accountId, "companies", { ...input, fallback: "q" }, (s, o) => s.findCompanies(described, o), (v) => (v as Company[]).length, { providerQuery: described, trail })) as Company[];
}

const SECTOR_PHRASE: Record<string, string> = {
  "Venture Capital & Private Equity": "venture capital and private equity firms",
  "Government Administration": "government entities and ministries",
  "Hospital & Health Care": "hospitals and healthcare groups",
  "Financial Services": "fintech and financial services companies",
};

/** A website from whatever was typed: a domain, a URL, or a company name. */
const asDomain = (v: string) => v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const looksLikeDomain = (v: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v);

/**
 * Resolves a company to its real website. "Tabby", or a guessed "tabby.sa",
 * become tabby.ai — the domain providers file people under.
 */
async function resolveDomain(accountId: string, typed: string, market: Market): Promise<string | null> {
  const stem = typed.includes(".") ? typed.split(".")[0] : typed;
  if (stem.length < 2) return null;
  const hits = (await run<Company>(accountId, "companies", { resolve: typed, market }, (s, o) => s.findCompanies({ name: stem, country: market, limit: 5 }, o), (v) => (v as Company[]).length, { charge: false, providerQuery: { name: stem, country: market, limit: 5 } })) as Company[];
  const exact = hits.find((c) => c.name.toLowerCase().replace(/\s+/g, "") === stem.toLowerCase().replace(/\s+/g, ""));
  return (exact ?? hits[0])?.domain ?? null;
}

export async function searchPeople(
  accountId: string,
  input: { companyDomain?: string; title?: string; keywords?: string; describe?: string; market: Market },
  trail?: Outcome[],
) {
  let domain = asDomain(clean(input.companyDomain));
  const title = clean(input.title, 60);
  const describe = clean(input.describe, 200);
  const keywords = clean(input.keywords).split(/[,،]/).map((k) => k.trim()).filter(Boolean).slice(0, 5);
  if (!domain && !title && !describe) throw new SearchError("bad_query", "a company, a role or a description");
  const m = MARKETS[input.market];
  const query = describe
    ? { q: `${describe} — based in ${m.location}`, location: m.location, keywords, limit: 20 }
    : { companyDomain: domain || undefined, title: title || undefined, keywords, country: input.market, limit: 20 };
  // A name rather than a website: find the website first.
  if (domain && !describe && !looksLikeDomain(domain)) {
    domain = (await resolveDomain(accountId, domain, input.market)) ?? domain;
    if (!describe) Object.assign(query, { companyDomain: domain });
  }
  let people = (await run<FoundPerson>(accountId, "people", { ...input, companyDomain: domain || undefined }, (s, o) => s.searchPeople(query, o), (v) => (v as FoundPerson[]).length, { providerQuery: query, trail })) as FoundPerson[];
  // A guessed domain (tabby.sa) finds nobody; retry once at the real one.
  if (people.length === 0 && domain && !describe) {
    const real = await resolveDomain(accountId, domain, input.market);
    if (real && real !== domain) {
      people = (await run<FoundPerson>(accountId, "people", { ...input, companyDomain: real }, (s, o) => s.searchPeople({ ...query, companyDomain: real }, o), (v) => (v as FoundPerson[]).length, { providerQuery: { ...query, companyDomain: real }, trail })) as FoundPerson[];
    }
  }
  return withSeniority(people);
}

export async function findPerson(accountId: string, input: { fullName: string; company?: string; market: Market }, trail?: Outcome[]) {
  const fullName = clean(input.fullName, 80);
  if (fullName.split(/\s+/).length < 2) throw new SearchError("bad_query", "a first and last name");
  const company = clean(input.company);
  const query = company.includes(".")
    ? { fullName, companyDomain: company.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), limit: 10 }
    : { fullName, location: MARKETS[input.market].location, limit: 10 };
  const raw = (await run<FoundPerson>(accountId, "person", { ...input }, (s, o) => s.searchPeople(query, o), (v) => (v as FoundPerson[]).length, { providerQuery: query, trail })) as FoundPerson[];
  // Providers match names loosely ("Firas Isa" for "Firas Jabbari"): keep the
  // rows that carry the surname, then put the chosen market first.
  const surname = fullName.toLowerCase().split(/\s+/).slice(-1)[0];
  const loose = (n: string) => n.toLowerCase().replace(/^al[- ]?/, "");
  const people = raw.filter((p) => p.name.toLowerCase().split(/\s+/).some((part) => loose(part) === loose(surname) || part.includes(surname)));
  const where = MARKETS[input.market].location.toLowerCase();
  const wanted = company.toLowerCase();
  return withSeniority(people).sort((a, b) =>
    Number((b.location ?? "").toLowerCase().includes(where)) - Number((a.location ?? "").toLowerCase().includes(where)) ||
    Number(!!wanted && (b.company.toLowerCase().includes(wanted) || b.companyDomain.includes(wanted))) -
    Number(!!wanted && (a.company.toLowerCase().includes(wanted) || a.companyDomain.includes(wanted))));
}

export async function searchNews(accountId: string, input: { company?: string; topic?: string; market: Market }, trail?: Outcome[]) {
  const company = clean(input.company);
  const topic = clean(input.topic);
  if (!company && !topic) throw new SearchError("bad_query", "a company or a topic");
  const year = new Date().getUTCFullYear();
  const q = company ? `"${company}" ${MARKETS[input.market].location} news ${year}` : `${topic} ${MARKETS[input.market].location} ${year}`;
  const signals = (await run<Signal>(accountId, "news", { ...input }, (s, o) => s.findSignals({ q, limit: 10 }, o), (v) => (v as Signal[]).length, { providerQuery: { q, limit: 10 }, trail })) as Signal[];
  return signals.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** The email lookup itself; credit reservation happens before, in the AccountGate. */
export async function lookupEmail(accountId: string, input: { fullName: string; domain?: string; linkedinUrl?: string }) {
  return (await run<{ email: string | null; verdict: EmailVerdict; servedBy: string }>(
    accountId, "email", { fullName: input.fullName, domain: input.domain },
    (s, o) => s.findEmail(input, { ...o, maxCostUsd: 0.05 }), (v) => ((v as { email: string | null }).email ? 1 : 0),
  )) as { email: string | null; verdict: EmailVerdict; servedBy: string };
}
