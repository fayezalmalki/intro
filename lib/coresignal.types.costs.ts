/**
 * What each vendor endpoint costs, in credits.
 *
 * Split out of lib/coresignal.ts for the same reason `EmailStatus` was: that
 * module is `server-only` because it holds the API key, and the price of a
 * collect has to be readable by the pure spend planner, by its tests, and by
 * the button that has to say "80 credits" before anyone presses it.
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
