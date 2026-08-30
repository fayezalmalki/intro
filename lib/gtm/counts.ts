import type { CountSource } from "../types";
import type { SegmentFilter } from "./segments";

/**
 * How many companies match a segment — and the query that says so.
 *
 * Phase 0's own note: these totals swing hard with query strictness. Saudi
 * companies with 50+ employees is 8,092; add "has an active job posting" and it
 * is 620. Both are true, and a card showing one of them with no query attached
 * is a card nobody can argue with, which is worse than one nobody believes.
 *
 * So the contract here is narrow and absolute:
 *
 *   • A count is returned only with the exact query object that produced it and
 *     the endpoint it was sent to. `segments_count_needs_query` in the schema
 *     holds the same rule one layer down.
 *   • No key, a vendor error, a missing `x-total-results` — all produce
 *     `unavailable` with a reason, and the card renders the reason instead of a
 *     number. There is no estimated, approximate or fallback count anywhere in
 *     this file, and adding one would be the single most expensive mistake
 *     available in this codebase.
 *
 * Free endpoints only. `company_base/search/filter` costs zero credits and
 * returns the total in a header, which is the whole reason segment counts are
 * affordable at all.
 */

/**
 * The vendor's own field names, as verified by Phase 0's live free calls
 * (docs in lib/coresignal.ts): country, employees_count_gte, industry.
 * Written out rather than built dynamically so a rename is a compile-time edit
 * in one place and not a silently empty filter.
 */
export interface CompanyFilterQuery {
  country: string;
  industry?: string;
  employees_count_gte?: number;
  employees_count_lte?: number;
  keyword?: string;
}

export const COUNT_ENDPOINT = "company_base/search/filter" as const;

/**
 * The filter, as the vendor wants it.
 *
 * Pure and exported because it is rendered to the user beside the count. The
 * thing the screen shows and the thing the client sends have to be the same
 * object, or the "inspect this count" affordance is theatre.
 */
export function buildCompanyQuery(filter: SegmentFilter): CompanyFilterQuery {
  const query: CompanyFilterQuery = { country: filter.country };
  if (filter.industry) query.industry = filter.industry;
  if (filter.employeesMin) query.employees_count_gte = filter.employeesMin;
  if (filter.employeesMax) query.employees_count_lte = filter.employeesMax;
  // One keyword, not four: the vendor's filter endpoint ANDs its fields, and
  // four ANDed keywords reliably return zero — which reads as "no such
  // companies" when it means "no company matches all four words at once".
  if (filter.keywords?.length) query.keyword = filter.keywords[0];
  return query;
}

export interface SegmentCount {
  source: CountSource;
  /** Null unless `source` is "coresignal". Never estimated. */
  total: number | null;
  query: CompanyFilterQuery;
  endpoint: typeof COUNT_ENDPOINT;
  /** Present when `source` is "unavailable" — shown in place of the number. */
  error?: string;
  /** Company ids the same free search returned, for the companies step. */
  ids: number[];
  creditsRemaining: number | null;
}

/** Just enough of the client to count with — keeps this module testable. */
export interface CountingClient {
  searchCompanies(filter: Record<string, unknown>): Promise<{
    ids: number[];
    total: number | null;
    creditsRemaining: number | null;
  }>;
}

export const NO_KEY_REASON =
  "ما فيه مفتاح Coresignal في هذي البيئة، فما نقدر نعطيك رقمًا حقيقيًا. الاستعلام جاهز ويشتغل أول ما يُضاف المفتاح.";

/**
 * Runs the free search and returns the count, or says why there isn't one.
 *
 * Never throws: a vendor outage must degrade one card to "no count", not fail
 * the run. The reason is the vendor's own status where we have one, because
 * "429" and "the key is wrong" call for different actions from whoever reads it.
 */
export async function countSegment(
  filter: SegmentFilter,
  client: CountingClient | null,
): Promise<SegmentCount> {
  const query = buildCompanyQuery(filter);
  const base = { query, endpoint: COUNT_ENDPOINT, ids: [] as number[] };

  if (!client) {
    return { ...base, source: "unavailable", total: null, error: NO_KEY_REASON, creditsRemaining: null };
  }

  try {
    const result = await client.searchCompanies(query as unknown as Record<string, unknown>);
    if (result.total === null) {
      return {
        ...base,
        source: "unavailable",
        total: null,
        error: "المزوّد رد بدون ترويسة x-total-results، فما فيه رقم نعرضه.",
        ids: result.ids,
        creditsRemaining: result.creditsRemaining,
      };
    }
    return {
      ...base,
      source: "coresignal",
      total: result.total,
      ids: result.ids,
      creditsRemaining: result.creditsRemaining,
    };
  } catch (error) {
    return {
      ...base,
      source: "unavailable",
      total: null,
      error: `المزوّد رفض الاستعلام: ${error instanceof Error ? error.message.slice(0, 120) : "خطأ غير معروف"}`,
      creditsRemaining: null,
    };
  }
}

/** The query as a single readable line, for the "where did this come from" row. */
export function describeQuery(query: CompanyFilterQuery): string {
  const parts = [`country=${query.country}`];
  if (query.industry) parts.push(`industry=${query.industry}`);
  if (query.employees_count_gte) parts.push(`employees≥${query.employees_count_gte}`);
  if (query.employees_count_lte) parts.push(`employees≤${query.employees_count_lte}`);
  if (query.keyword) parts.push(`keyword=${query.keyword}`);
  return parts.join(" · ");
}
