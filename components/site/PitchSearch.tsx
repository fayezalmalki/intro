"use client";

import { useState } from "react";
import type { Pitch } from "@/lib/site/pitch";
import { MARKETS } from "@/lib/search/markets";
import { Icon, cx } from "./ui";

/**
 * The landing's search. Posts to /start, which asks a signed-out visitor to
 * create their account first and runs this search the moment they are in.
 * Works without JavaScript (a plain GET form); the script only swaps the
 * example to match the chosen tab.
 */
export function PitchSearch({ search: s, locale, compact }: { search: Pitch["search"]; locale: Pitch["locale"]; compact?: boolean }) {
  const [mode, setMode] = useState(s.tabs[0].mode);
  const tab = s.tabs.find((x) => x.mode === mode) ?? s.tabs[0];
  return (
    <form action="/start" method="get" className={cx("flex w-full flex-col gap-3 rounded-[22px] bg-white p-3 text-start shadow-[0_24px_60px_-28px_#1416134d] outline outline-1 -outline-offset-1 outline-line", compact ? "max-w-[680px]" : "max-w-[760px]")}>
      <input type="hidden" name="lang" value={locale} />
      <fieldset className="flex flex-col gap-2 px-1 pt-1">
        <legend className="sr-only">{s.label}</legend>
        <div role="radiogroup" aria-label={s.label} className="grid grid-cols-3 gap-1 rounded-[14px] bg-surface p-1">
          {s.tabs.map((x) => (
            <label key={x.mode} className="flex cursor-pointer items-center justify-center rounded-[11px] px-2 py-2 text-center text-[13.5px] font-medium text-muted transition-colors has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-[0_1px_2px_#0000001a] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
              <input type="radio" name="mode" value={x.mode} checked={mode === x.mode} onChange={() => setMode(x.mode)} className="sr-only" />
              {x.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[14px] bg-surface-2 px-3.5 outline outline-1 -outline-offset-1 outline-transparent focus-within:outline-brand/50">
          <Icon name="search" className="shrink-0 text-subtle" />
          <span className="sr-only">{s.label}</span>
          <input name="q" required dir="auto" maxLength={300} placeholder={tab.placeholder} className="min-w-0 flex-1 bg-transparent text-[15.5px] text-ink outline-none placeholder:text-subtle" />
        </label>
        <label className="sr-only" htmlFor={`market-${compact ? "c" : "h"}`}>{s.market}</label>
        <select id={`market-${compact ? "c" : "h"}`} name="market" defaultValue="SA" className="h-[52px] rounded-[14px] bg-surface-2 px-3 text-[14.5px] text-ink outline-none sm:w-[150px]">
          {(Object.keys(MARKETS) as (keyof typeof MARKETS)[]).map((m) => <option key={m} value={m}>{MARKETS[m][locale]}</option>)}
        </select>
        <button type="submit" className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-brand px-6 text-[15.5px] font-medium text-white transition-colors hover:bg-brand-2">
          {s.submit}
          <Icon name="arrow-right" size={15} flip />
        </button>
      </div>
      <p className="px-1.5 pb-0.5 text-[12.5px] leading-[19px] text-subtle rtl:leading-[22px]">{s.note}</p>
    </form>
  );
}
