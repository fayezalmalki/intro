/**
 * What a credit is, what it costs, and why every bundle costs the same per unit.
 *
 * A credit buys one outbound message through the send gate. Not a lookup, not a
 * draft, not a segment — those are free and stay free, because the value has to
 * be visible before anyone is asked for money. The paywall sits at the send, and
 * only at the send.
 *
 * **No volume discount, deliberately.** docs/03-design-review.md §5: never price
 * so that blasting is cheaper per send. Under a per-send meter a bulk discount
 * is a subsidy for exactly the behaviour the near-duplicate detector spends its
 * time refusing. Larger bundles buy fewer checkouts, not a lower rate, and
 * `pricing.test.ts` holds that as an invariant rather than a good intention.
 */

/** In halalas, so money is never a float anywhere in this codebase. */
export const HALALAS_PER_CREDIT = 990;

export interface Bundle {
  id: string;
  credits: number;
  halalas: number;
}

export const BUNDLES: readonly Bundle[] = [
  { id: "start", credits: 10, halalas: 10 * HALALAS_PER_CREDIT },
  { id: "team", credits: 50, halalas: 50 * HALALAS_PER_CREDIT },
  { id: "scale", credits: 200, halalas: 200 * HALALAS_PER_CREDIT },
];

export function bundleById(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

/**
 * «٩٩ ر.س» — halalas in, a price out, never a float in between.
 *
 * Whole riyals print without a decimal part. Every bundle here is a whole
 * number of riyals, and "1,980٫00" beside "1,980" in a thousands separator was
 * two different separators in one string, which reads as a typo rather than a
 * price.
 */
export function formatSar(halalas: number): string {
  const riyals = Math.floor(halalas / 100);
  const rest = halalas % 100;
  const whole = riyals.toLocaleString("en-US");
  return rest === 0 ? `${whole} ر.س` : `${whole}.${String(rest).padStart(2, "0")} ر.س`;
}

/** What one credit costs in this bundle. Equal across all of them, by design. */
export function unitHalalas(bundle: Bundle): number {
  return bundle.halalas / bundle.credits;
}
