/**
 * Seat-change detection, as a pure function over two id sets.
 *
 * The whole reason Radar can run weekly without a bill is that Coresignal's
 * search endpoints cost nothing and return *id arrays* — no names, no titles,
 * no profiles. Storing last week's ids for a company and diffing them against
 * this week's therefore detects who arrived and who left for zero credits.
 * A name is only ever bought for a row an account manager has approved for
 * publication (see `resolve.ts`), so the meter follows editorial judgement
 * instead of leading it.
 *
 * Everything below is about the ways that diff can lie.
 */

export type ChangeKind = "arrival" | "departure";

export interface SeatChange {
  coresignalEmployeeId: number;
  kind: ChangeKind;
}

/** Why a comparison produced nothing, when it produced nothing. */
export type SkipReason =
  /** No stored baseline: this run establishes one and reports nothing. */
  | "first_run"
  /** The search came back truncated, so absence proves nothing. */
  | "truncated"
  /** Everyone vanished at once — a failed query looks exactly like this. */
  | "empty_result"
  /** More churn than a real week produces; treated as a query change. */
  | "implausible_churn";

export interface DiffOutcome {
  changes: SeatChange[];
  /** Present when no changes were emitted, naming the reason. */
  skipped: SkipReason | null;
  /** Always the current set — the caller stores it as the next baseline. */
  baseline: number[];
}

/**
 * Above this share of the previous set changing, we assume the query moved
 * rather than the market. A bank does not replace two thirds of its leadership
 * in a week; a title-term edit or a vendor-side reindex looks exactly like it.
 */
export const CHURN_LIMIT = 0.5;

/** Below this many seats, ratios are noise — three people is not a trend. */
export const MIN_BASELINE_FOR_CHURN = 6;

export interface DiffInput {
  /** Last run's ids, or null the first time this company is seen. */
  previous: number[] | null;
  /** This run's ids. */
  current: number[];
  /**
   * What the provider said the full result size was. When it exceeds the ids
   * actually returned, the set is a page rather than a census — see below.
   */
  total?: number | null;
}

/**
 * Compare two id sets and say what changed.
 *
 * The guards are the point. Each corresponds to a way the naive diff would
 * publish a false claim about a named executive, which is the one failure this
 * product cannot absorb:
 *
 * - **First run.** With no baseline, every seat reads as an arrival, and the
 *   first issue would announce that a bank's entire leadership just joined.
 *   The first run stores and says nothing.
 *
 * - **Truncated result.** `search/filter` answers with a page plus a total. If
 *   the total exceeds what came back, the ids we did not receive are
 *   indistinguishable from people who left. Absence only means departure when
 *   the set is complete.
 *
 * - **Empty result.** An expired key, a changed field name, a company id that
 *   stopped resolving — all return zero ids, which the naive diff reads as the
 *   entire leadership resigning simultaneously. A non-empty baseline going to
 *   nothing is treated as breakage, never as news.
 *
 * - **Implausible churn.** Short of that, a query edit still moves a large
 *   fraction of the set at once. Real weekly movement is a seat or two.
 */
export function diffSeats({ previous, current, total = null }: DiffInput): DiffOutcome {
  const currentSet = unique(current);
  const baseline = currentSet;

  if (previous === null) return { changes: [], skipped: "first_run", baseline };

  if (total !== null && total > currentSet.length) {
    // Keep the previous baseline by returning it: overwriting a complete set
    // with a partial page would make the *next* run's diff wrong too.
    return { changes: [], skipped: "truncated", baseline: unique(previous) };
  }

  const previousSet = unique(previous);

  if (currentSet.length === 0 && previousSet.length > 0) {
    return { changes: [], skipped: "empty_result", baseline: previousSet };
  }

  const before = new Set(previousSet);
  const after = new Set(currentSet);
  const arrivals = currentSet.filter((id) => !before.has(id));
  const departures = previousSet.filter((id) => !after.has(id));

  if (
    previousSet.length >= MIN_BASELINE_FOR_CHURN &&
    (arrivals.length + departures.length) / previousSet.length > CHURN_LIMIT
  ) {
    return { changes: [], skipped: "implausible_churn", baseline: previousSet };
  }

  return {
    changes: [
      ...arrivals.map((id) => ({ coresignalEmployeeId: id, kind: "arrival" as const })),
      ...departures.map((id) => ({ coresignalEmployeeId: id, kind: "departure" as const })),
    ],
    skipped: null,
    baseline,
  };
}

/** Sorted so a stored baseline is comparable byte for byte between runs. */
function unique(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}
