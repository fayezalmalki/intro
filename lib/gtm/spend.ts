import { CREDIT_COST } from "../coresignal.types.costs";

/**
 * The paid step, and the confirmation that has to precede it.
 *
 * This is the most expensive rule in the codebase to get wrong. The balance is
 * about 1,730 vendor credits — roughly 86 person collects — and buying
 * enrichment for a row the user then deletes in review is the fastest way to
 * spend it on nothing. So the shape is fixed:
 *
 *   1. Free searches produce rows. Rows cost nothing and can be discarded
 *      freely.
 *   2. The user explicitly keeps the rows they want.
 *   3. `planCollect` prices exactly those rows and nothing else.
 *   4. The user is shown the number and confirms *that* number. A form that
 *      posts back a different figure than the one on screen is refused, because
 *      it means the page the user agreed to is not the page being executed —
 *      a stale tab, a second window, or rows kept in between.
 *
 * Step 4 is why `confirmedCredits` exists rather than a plain "collect" button.
 * A confirmation that does not name the amount is not a confirmation.
 */

export const PERSON_COLLECT_CREDITS: number = CREDIT_COST["employee_multi_source/collect"];
export const COMPANY_COLLECT_CREDITS: number = CREDIT_COST["company_clean/collect"];

export interface CollectableRow {
  id: string;
  kept: boolean;
  /** Set once the row was actually bought. A second collect is served from cache. */
  collectedAt?: string | null;
  /** The vendor id. Without one there is nothing to buy. */
  coresignalId?: number | null;
}

export interface SpendPlan {
  /** Row ids that will be bought, in order. */
  buy: string[];
  /** Kept rows we already own — free, and worth showing so the total adds up. */
  alreadyOwned: string[];
  /** Kept rows with no vendor id: nothing to buy, and the UI says why. */
  unbuyable: string[];
  perRow: number;
  credits: number;
}

/**
 * Prices a collect over a set of rows.
 *
 * Three exclusions, and each one is a category of wasted credit:
 *   • not kept        — the user did not ask for this row
 *   • already bought  — apiCallLog serves it from the stored response for free
 *   • no vendor id    — there is no purchase to make, only a failed call
 */
export function planCollect(rows: CollectableRow[], perRow = PERSON_COLLECT_CREDITS): SpendPlan {
  const kept = rows.filter((r) => r.kept);
  const buy: string[] = [];
  const alreadyOwned: string[] = [];
  const unbuyable: string[] = [];

  for (const row of kept) {
    if (row.collectedAt) alreadyOwned.push(row.id);
    else if (!row.coresignalId) unbuyable.push(row.id);
    else buy.push(row.id);
  }

  return { buy, alreadyOwned, unbuyable, perRow, credits: buy.length * perRow };
}

export type SpendRefusal =
  | "nothing_to_buy"
  | "confirmation_mismatch"
  | "insufficient_vendor_credits";

export interface SpendVerdict {
  allowed: boolean;
  refusal?: SpendRefusal;
  reason?: string;
  plan: SpendPlan;
}

const REFUSAL_REASON: Record<SpendRefusal, string> = {
  nothing_to_buy: "ما فيه صفوف محفوظة تحتاج شراء. اختر الصفوف اللي تبيها أولًا.",
  confirmation_mismatch:
    "تغيّر عدد الصفوف بعد ما شفت السعر. راجع القائمة والرقم الجديد قبل الشراء.",
  insufficient_vendor_credits:
    "الرصيد عند المزوّد أقل من تكلفة هذي العملية. قلّل الصفوف أو أضف رصيدًا.",
};

/**
 * The gate in front of every paid vendor call.
 *
 * `confirmedCredits` is the figure the user saw. Comparing it against the
 * freshly computed plan is what makes the confirmation mean something: if a row
 * was kept or dropped in another tab between render and submit, the amounts
 * differ and the spend is refused rather than quietly costing more than the
 * screen promised.
 *
 * `vendorCreditsRemaining` is the last balance the vendor reported. Null means
 * we have never seen one — we let the call through in that case rather than
 * blocking the product on a header we may simply not have observed yet, and the
 * vendor enforces its own balance regardless.
 */
export function confirmSpend(
  rows: CollectableRow[],
  confirmedCredits: number,
  vendorCreditsRemaining: number | null,
  perRow = PERSON_COLLECT_CREDITS,
): SpendVerdict {
  const plan = planCollect(rows, perRow);

  if (plan.buy.length === 0) {
    return { allowed: false, refusal: "nothing_to_buy", reason: REFUSAL_REASON.nothing_to_buy, plan };
  }
  if (confirmedCredits !== plan.credits) {
    return {
      allowed: false,
      refusal: "confirmation_mismatch",
      reason: REFUSAL_REASON.confirmation_mismatch,
      plan,
    };
  }
  if (vendorCreditsRemaining !== null && vendorCreditsRemaining < plan.credits) {
    return {
      allowed: false,
      refusal: "insufficient_vendor_credits",
      reason: REFUSAL_REASON.insufficient_vendor_credits,
      plan,
    };
  }
  return { allowed: true, plan };
}

/** «٤ صفوف · ٨٠ رصيد» — the sentence the button has to carry. */
export function spendLabel(plan: SpendPlan): string {
  return `${plan.buy.length} صف · ${plan.credits} رصيد`;
}
