import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SearchApp, type SearchDefaults } from "@/components/app/SearchApp";
import { pickLang } from "@/components/site/AuthShell";
import * as repo from "@/lib/db/repo";
import { isMarket } from "@/lib/search/markets";
import { PRESETS, type SearchMode } from "@/lib/search/presets";
import { pageAccount } from "@/lib/session";
import type { UseCaseId } from "@/lib/site/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search · intro" };

const MODES = new Set<SearchMode>(["companies", "people", "person", "news"]);

/**
 * Instant search. Everything on the URL (?mode, ?market, ?sector, ?role,
 * ?keywords, ?describe, ?q, ?preset, ?run) so a landing link or a use-case
 * card can open a search that runs on arrival.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  const account = await pageAccount(`/search${qs ? `?${qs}` : ""}`);
  const lang = pickLang(p.lang, undefined, account.locale ?? "ar");
  const preset = p.preset && p.preset in PRESETS ? PRESETS[p.preset as UseCaseId] : undefined;

  const defaults: SearchDefaults = {
    mode: MODES.has(p.mode as SearchMode) ? (p.mode as SearchMode) : preset?.mode ?? (p.q ? "people" : "companies"),
    market: isMarket(p.market) ? p.market : preset?.market ?? "SA",
    sector: p.sector ?? preset?.sector,
    role: p.role ?? preset?.role,
    keywords: p.keywords ?? (p.q && p.mode === "companies" ? p.q : undefined) ?? preset?.keywords,
    describe: p.describe ?? (p.q && p.mode !== "companies" ? p.q : undefined) ?? preset?.describe?.[lang],
    name: p.name,
    fullName: p.fullName,
    topic: p.topic ?? (p.q && p.mode === "news" ? p.q : undefined),
    signal: p.signal,
    run: p.run === "1" || Boolean(preset) || Boolean(p.q),
  };
  const [credits, saved] = await Promise.all([repo.creditBalance(account.id), repo.listCriteria(account.id)]);

  return (
    <AppShell account={account} lang={lang} on="search" mode={defaults.mode} credits={credits}>
      <SearchApp lang={lang} defaults={defaults} initialCredits={credits} saved={saved.map((c) => ({ id: c.id, name: c.name, market: c.market, sector: c.sector ?? "", keywords: c.keywords ?? "", role: c.role ?? "", signal: c.signal ?? "" }))} />
    </AppShell>
  );
}
