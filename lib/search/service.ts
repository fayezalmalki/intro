import { env } from "cloudflare:workers";
import * as repo from "../db/repo";
import { TregError, TregProvider, type EmailVerdict } from "../sourcing/treg";
import type { Company, FoundPerson, Priced, Signal } from "../sourcing/provider";
import { LEADERSHIP, seniorityOf } from "../sourcing/vocabulary";
import { devToolsEnabled } from "../env";
import { MARKETS, type Market } from "./markets";
import { FakeSearch } from "./fake";

/**
 * Instant search (/search): companies, people, one named person, news, and an
 * email reveal — each a routed treg tool. Every call is capped per request,
 * counted against the account's daily budget, and logged with what it cost.
 */

/** Per account per UTC day. Searches are free to the user; this caps our spend. */
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

async function run<T>(
  accountId: string,
  kind: "companies" | "people" | "person" | "news" | "email",
  query: Record<string, unknown>,
  call: (s: Searcher, o: Opts) => Promise<Priced<T[]> | Priced<T>>,
  count: (v: T[] | T) => number,
): Promise<T[] | T> {
  const s = searcher();
  if (!s) throw new SearchError("unavailable");
  if (kind !== "email") {
    const usage = await repo.searchUsageToday(accountId);
    if (usage.count >= DAILY_SEARCHES || usage.costMicro >= DAILY_BUDGET_MICRO) throw new SearchError("budget");
  }
  try {
    const r = await call(s, { maxCostUsd: PER_CALL_MAX_USD, idempotencyKey: `${accountId}:${kind}:${crypto.randomUUID()}` });
    await repo.logSearch({ accountId, kind, query, results: count(r.value), costMicro: r.costMicro });
    return r.value;
  } catch (error) {
    if (error instanceof TregError) {
      await repo.logSearch({ accountId, kind, query: { ...query, error: error.status }, results: 0, costMicro: 0 });
      // A 4xx is our request; a 402 is the per-call cap. Neither should retry elsewhere.
      throw new SearchError(error.status === 402 ? "budget" : error.status < 500 ? "bad_query" : "upstream", error.message);
    }
    throw error;
  }
}

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface PersonResult extends FoundPerson { seniority: string; leader: boolean }

const withSeniority = (people: FoundPerson[]): PersonResult[] =>
  people
    .filter((p) => p.name && p.title)
    .map((p) => ({ ...p, seniority: seniorityOf(p.title), leader: LEADERSHIP.includes(seniorityOf(p.title)) }))
    // Decision makers first; providers return them in no particular order.
    .sort((a, b) => Number(b.leader) - Number(a.leader));

export async function searchCompanies(accountId: string, input: { sector?: string; keywords?: string; name?: string; market: Market }) {
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
  return (await run<Company>(accountId, "companies", { ...input }, (s, o) => s.findCompanies(query, o), (v) => (v as Company[]).length)) as Company[];
}

export async function searchPeople(
  accountId: string,
  input: { companyDomain?: string; title?: string; keywords?: string; describe?: string; market: Market },
) {
  const domain = clean(input.companyDomain).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const title = clean(input.title, 60);
  const describe = clean(input.describe, 200);
  const keywords = clean(input.keywords).split(/[,،]/).map((k) => k.trim()).filter(Boolean).slice(0, 5);
  if (!domain && !title && !describe) throw new SearchError("bad_query", "a company, a role or a description");
  const m = MARKETS[input.market];
  const query = describe
    ? { q: `${describe} — based in ${m.location}`, location: m.location, keywords, limit: 20 }
    : { companyDomain: domain || undefined, title: title || undefined, keywords, country: input.market, limit: 20 };
  const people = (await run<FoundPerson>(accountId, "people", { ...input }, (s, o) => s.searchPeople(query, o), (v) => (v as FoundPerson[]).length)) as FoundPerson[];
  return withSeniority(people);
}

export async function findPerson(accountId: string, input: { fullName: string; company?: string; market: Market }) {
  const fullName = clean(input.fullName, 80);
  if (fullName.split(/\s+/).length < 2) throw new SearchError("bad_query", "a first and last name");
  const company = clean(input.company);
  const query = company.includes(".")
    ? { fullName, companyDomain: company.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), limit: 10 }
    : { fullName, location: MARKETS[input.market].location, limit: 10 };
  const people = (await run<FoundPerson>(accountId, "person", { ...input }, (s, o) => s.searchPeople(query, o), (v) => (v as FoundPerson[]).length)) as FoundPerson[];
  const wanted = company.toLowerCase();
  return withSeniority(people).sort((a, b) =>
    Number(!!wanted && (b.company.toLowerCase().includes(wanted) || b.companyDomain.includes(wanted))) -
    Number(!!wanted && (a.company.toLowerCase().includes(wanted) || a.companyDomain.includes(wanted))));
}

export async function searchNews(accountId: string, input: { company?: string; topic?: string; market: Market }) {
  const company = clean(input.company);
  const topic = clean(input.topic);
  if (!company && !topic) throw new SearchError("bad_query", "a company or a topic");
  const year = new Date().getUTCFullYear();
  const q = company ? `"${company}" ${MARKETS[input.market].location} news ${year}` : `${topic} ${MARKETS[input.market].location} ${year}`;
  const signals = (await run<Signal>(accountId, "news", { ...input }, (s, o) => s.findSignals({ q, limit: 10 }, o), (v) => (v as Signal[]).length)) as Signal[];
  return signals.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** The email lookup itself; credit reservation happens before, in the AccountGate. */
export async function lookupEmail(accountId: string, input: { fullName: string; domain?: string; linkedinUrl?: string }) {
  return (await run<{ email: string | null; verdict: EmailVerdict; servedBy: string }>(
    accountId, "email", { fullName: input.fullName, domain: input.domain },
    (s, o) => s.findEmail(input, { ...o, maxCostUsd: 0.05 }), (v) => ((v as { email: string | null }).email ? 1 : 0),
  )) as { email: string | null; verdict: EmailVerdict; servedBy: string };
}
