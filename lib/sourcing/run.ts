import type { Brief } from "../types";
import {
  BudgetExhausted, type CallOptions, type Company, type FoundPerson, type Signal, type SourcingProvider,
} from "./provider";
import { score, type Candidate, type ScoredItem } from "./score";
import { TregError } from "./treg";
import { titleMatches, LEADERSHIP, seniorityOf, planSearch, type SearchPlan } from "./vocabulary";

/**
 * Real sourcing for one request: companies in the sector → the right people
 * at each → dated signals per company → ranked, evidence-backed rows.
 *
 * Every stage runs through `step`, which RequestWorkflow binds to
 * `step.do(name, fn)`: a stage that already finished is replayed from its
 * stored result after a retry or a restart, so nothing is bought twice. Tests
 * pass the identity step and run the same code inline.
 *
 * Spend is summed from the stages' own results (each reports what it was
 * charged), so a replayed run computes the same running total, and every call
 * is capped at what is left of the request's budget.
 */

export const BUDGET_MICRO = 250_000; // $0.25 per request
const PER_CALL_CAP_MICRO = 50_000; // $0.05: no single call may take the whole budget
const COMPANIES = 6;
const PEOPLE_PER_COMPANY = 4;
const COUNTRY = "SA";

export type Step = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
export const inline: Step = (_name, fn) => fn();

export interface SourcingInput {
  requestId: string;
  brief: Brief;
  rawText: string;
  sectors: string[];
}

export interface SourcingResult {
  items: ScoredItem[];
  candidates: Candidate[];
  spentMicro: number;
  scoredBy: "claude" | "rules";
  plan: SearchPlan;
  /** Why the run stopped short, if it did (shown to the account manager). */
  note?: string;
}

interface Stage<T> { value: T; costMicro: number; failed?: string }

export async function runSourcing(
  input: SourcingInput,
  deps: { provider: SourcingProvider; anthropicKey?: string; budgetMicro?: number },
  step: Step = inline,
): Promise<SourcingResult> {
  const budget = deps.budgetMicro ?? BUDGET_MICRO;
  const plan = planSearch(input.brief, input.rawText, input.sectors);
  let spent = 0;
  const notes: string[] = [];

  const options = (key: string): CallOptions => {
    const remaining = budget - spent;
    if (remaining <= 0) throw new BudgetExhausted(spent);
    return {
      maxCostUsd: Math.min(remaining, PER_CALL_CAP_MICRO) / 1_000_000,
      idempotencyKey: `${input.requestId}:${key}`,
    };
  };

  /** Runs a paid stage; a failure is recorded and skipped, never fatal to the run. */
  const stage = async <T>(name: string, empty: T, fn: () => Promise<{ value: T; costMicro: number }>) => {
    let result: Stage<T>;
    try {
      result = await step(name, async (): Promise<Stage<T>> => {
        try {
          return await fn();
        } catch (error) {
          // treg's 402 route_max_cost: the call could not fit in what is left.
          const overCap = error instanceof TregError && error.status === 402;
          if (error instanceof BudgetExhausted || overCap) return { value: empty, costMicro: 0, failed: "budget" };
          throw error; // let the workflow retry transient failures
        }
      });
    } catch (error) {
      result = { value: empty, costMicro: 0, failed: error instanceof Error ? error.message : String(error) };
      console.error(`[sourcing] ${input.requestId} ${name} failed: ${String(result.failed).slice(0, 300)}`);
    }
    spent += result.costMicro;
    if (result.failed === "budget") notes.push("توقف البحث عند حد الميزانية.");
    else if (result.failed) notes.push(`تعذّرت خطوة ${name}.`);
    return result.value;
  };

  // 1 — companies in the sector(s)
  const companyLists: Company[][] = [];
  const queries = plan.industries.length
    ? plan.industries.map((industry) => ({ industry }))
    : plan.fallbackQuery ? [{ q: plan.fallbackQuery }] : [];
  if (queries.length === 0) notes.push("ما قدرنا نحدد القطاع من الطلب.");
  for (const [i, q] of queries.entries()) {
    companyLists.push(await stage(`companies-${i}`, [] as Company[], () =>
      deps.provider.findCompanies({ ...q, country: COUNTRY, limit: 25 }, options(`companies-${i}`))));
  }
  // Regulators and ministries share sector tags with the companies they
  // regulate (GOSI under insurance, SAMA under financial services); they are
  // not who a sector search means unless the sector is government itself.
  const wantsGov = plan.industries.includes("Government Administration");
  const companies = interleave(companyLists)
    .filter((c, i, all) => all.findIndex((x) => x.domain === c.domain) === i)
    .filter((c) => wantsGov || !/\.gov\.sa$/.test(c.domain))
    .slice(0, COMPANIES);
  if (companies.length === 0) notes.push("ما لقينا شركات تطابق القطاع.");

  // 2 — the right people at each company, and 3 — dated signals for it
  const candidates: Candidate[] = [];
  for (const company of companies) {
    const people = await stage(`people-${company.domain}`, [] as FoundPerson[], () =>
      deps.provider.findPeople(
        { companyDomain: company.domain, title: plan.titles[0], country: COUNTRY,
          limit: input.brief.seniority.includes("قيادي") ? 25 : 10 },
        options(`people-${company.domain}`),
      ));
    // A brief that asks for leadership gets leaders: "Product Analyst" matches
    // the title fragment but is not who a senior job seeker should write to.
    const leadersOnly = input.brief.seniority.includes("قيادي");
    const relevant = people
      .filter((p) => p.profileUrl)
      .filter((p) => {
        const lead = LEADERSHIP.includes(seniorityOf(p.title));
        return leadersOnly ? lead : lead || titleMatches(p.title, plan.titles);
      })
      .slice(0, PEOPLE_PER_COMPANY);
    if (relevant.length === 0) continue;

    const signals = await stage(`signals-${company.domain}`, [] as Signal[], () =>
      deps.provider.findSignals(
        { q: `"${company.name}" Saudi announcement ${new Date().getUTCFullYear()}`, limit: 6 },
        options(`signals-${company.domain}`),
      ));
    const recent = signals
      .filter((s) => aboutCompany(s, company))
      .filter((s) => !s.date || Date.now() - new Date(s.date).getTime() < 365 * 86_400_000)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 3);

    for (const person of relevant) {
      const key = person.profileUrl ?? `${person.name}@${company.domain}`;
      // One company can be listed under two domains (tawuniya.com, tawuniya.com.sa),
      // and a provider can list one person twice: one row per person.
      const dupe = candidates.some((c) => c.key === key || compact(c.person.name) === compact(person.name));
      if (!dupe) candidates.push({ key, person, company, signals: recent });
    }
  }

  // 4 — rank and draft. Not a paid treg call, but a stored step all the same:
  // a retry after persisting must not draft (and bill Claude) again.
  const scored = await step("score", () =>
    score({ apiKey: deps.anthropicKey, brief: input.brief, rawText: input.rawText, plan, candidates }));

  return {
    items: scored.items,
    candidates,
    spentMicro: spent,
    scoredBy: scored.scoredBy,
    plan,
    note: [...new Set(notes)].join(" ") || undefined,
  };
}

/** Quote pages, screeners and index pages: always "updated today", never an event. */
const NOT_NEWS_TITLE =
  /stock (price|analysis|quote)|share price|press releases|market news|markets data|company profile|financials|\((sase|tadawul):|^news\b|- tadawul|\| tadawul/i;
const NOT_NEWS_HOST = /simplywall\.st|marketscreener\.com|investing\.com|stockanalysis\.com|tradingview\.com|wsj\.com\/market-data|saudiexchange\.sa|linkedin\.com|wikipedia\.org/;

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, "");

/**
 * A search result counts as a signal only if it is about this company: its
 * title or snippet names the company or its domain. Search engines return
 * listing pages ("Press Releases & Events", a stock screener) with a crawl
 * date that would otherwise pass as today's news.
 */
export function aboutCompany(signal: Signal, company: Company): boolean {
  if (NOT_NEWS_TITLE.test(signal.title) || NOT_NEWS_HOST.test(signal.source)) return false;
  const text = compact(`${signal.title} ${signal.snippet ?? ""}`);
  const stem = compact(company.domain.split(".")[0]);
  const name = compact(company.name);
  // A title that is only the company's name is its profile or home page.
  const title = compact(signal.title);
  if (title === stem || title === name) return false;
  return (stem.length >= 3 && text.includes(stem)) || (name.length >= 4 && text.includes(name));
}

/** Round-robin across sector lists so two sectors share the company slots. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}
