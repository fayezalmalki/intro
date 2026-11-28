/**
 * Credit packs, in SAR. One credit = one search or one verified-email reveal.
 * Prices are a starting point to tune: our measured provider cost is about
 * $0.001–$0.025 per search and $0.005 per verified email.
 */
export const PACKAGES = [
  { id: "starter", credits: 100, sar: 99, en: "Starter", ar: "البداية" },
  { id: "growth", credits: 300, sar: 249, en: "Growth", ar: "النمو", popular: true },
  { id: "scale", credits: 1000, sar: 699, en: "Scale", ar: "التوسّع" },
] as const;

/**
 * A 1 SAR pack for checking live payments end to end (Moyasar's minimum).
 * Admins only: never listed to customers, and refused server-side for them.
 */
export const LIVE_TEST_PACK = { id: "live-test", credits: 1, sar: 1, en: "Live payment test", ar: "اختبار الدفع الحي" } as const;

export type PackageId = (typeof PACKAGES)[number]["id"] | typeof LIVE_TEST_PACK.id;
export const packageById = (id: string, opts: { admin?: boolean } = {}) =>
  PACKAGES.find((p) => p.id === id) ?? (opts.admin && id === LIVE_TEST_PACK.id ? LIVE_TEST_PACK : undefined);
