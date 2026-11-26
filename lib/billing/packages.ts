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

export type PackageId = (typeof PACKAGES)[number]["id"];
export const packageById = (id: string) => PACKAGES.find((p) => p.id === id);
