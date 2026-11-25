import type { UseCaseId } from "../site/types";
import type { Market } from "./markets";

export type SearchMode = "companies" | "people" | "person" | "news";

/**
 * Each goal, as a search that returns something on the first click. Company
 * presets carry the role to look for once a company is picked, so "Sell into
 * a sector" goes sector → companies → their decision makers in two clicks.
 */
export interface Preset {
  mode: SearchMode;
  market: Market;
  sector?: string;
  keywords?: string;
  role?: string;
  describe?: { en: string; ar: string };
}

export const PRESETS: Record<UseCaseId, Preset> = {
  sell: { mode: "companies", market: "SA", sector: "Insurance", role: "Chief" },
  hire: { mode: "people", market: "SA", describe: { en: "Engineering managers and senior software engineers at Saudi tech companies", ar: "Engineering managers and senior software engineers at Saudi tech companies" } },
  partner: { mode: "companies", market: "SA", sector: "Logistics and Supply Chain", role: "Partnerships" },
  "enter-market": { mode: "companies", market: "SA", sector: "Hospital & Health Care", role: "Head" },
  "hire-me": { mode: "companies", market: "SA", sector: "Financial Services", role: "Product" },
  invest: { mode: "companies", market: "SA", sector: "Venture Capital & Private Equity", role: "Partner" },
};

/** /search?… for a preset, in a language. */
export function presetHref(id: UseCaseId, lang: "ar" | "en"): string {
  const p = PRESETS[id];
  const q = new URLSearchParams({ mode: p.mode, market: p.market, lang });
  if (p.sector) q.set("sector", p.sector);
  if (p.role) q.set("role", p.role);
  if (p.keywords) q.set("keywords", p.keywords);
  if (p.describe) q.set("describe", p.describe[lang]);
  q.set("run", "1");
  return `/search?${q.toString()}`;
}
