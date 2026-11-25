import type { ReactNode } from "react";
import { Geist, Inter_Tight } from "next/font/google";
import { Wordmark, cx } from "./ui";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

export type Lang = "ar" | "en";

/**
 * The language of an auth screen: ?lang=, else the lang= the landing put on
 * the link that started the journey (carried inside `next`), else Arabic —
 * the app's language.
 */
export function pickLang(lang?: string, next?: string, fallback: Lang = "ar"): Lang {
  if (lang === "en" || lang === "ar") return lang;
  const carried = /[?&]lang=(en|ar)\b/.exec(next ?? "")?.[1];
  return (carried as Lang | undefined) ?? fallback;
}

/** The same URL with ?lang= set to `to` (for the language switch). */
export function withLang(path: string, params: Record<string, string | undefined>, to: Lang): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== "lang") q.set(k, v);
  q.set("lang", to);
  return `${path}?${q.toString()}`;
}

/**
 * The frame for sign-in, onboarding and activation: the marketing site's
 * look (site.css), a narrow card, and a language switch that keeps the
 * current query string.
 */
export function AuthShell({
  lang, switchHref, step, children, wide,
}: { lang: Lang; switchHref: string; step?: { at: number; of: number; label: string }; children: ReactNode; wide?: boolean }) {
  const rtl = lang === "ar";
  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} data-dir={rtl ? "rtl" : "ltr"} className={`site ${geist.variable} ${interTight.variable} min-h-dvh bg-surface-3`}>
      <header className="mx-auto flex h-[72px] w-full max-w-[1152px] items-center justify-between px-4 sm:px-6">
        <a href={rtl ? "/ar" : "/"} aria-label="intro.sa"><Wordmark lang={lang} /></a>
        <a href={switchHref} lang={rtl ? "en" : "ar"} className={cx("text-[14px] font-medium text-muted hover:text-ink", rtl ? "font-latin" : "font-ar")}>
          {rtl ? "English" : "العربية"}
        </a>
      </header>
      <main className={cx("mx-auto w-full px-4 pt-6 pb-16 sm:pt-12", wide ? "max-w-[620px]" : "max-w-[440px]")}>
        {step && (
          <div className="mb-5 flex items-center gap-3">
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: step.of }, (_, i) => (
                <span key={i} className={cx("h-1 flex-1 rounded-full", i < step.at ? "bg-brand" : "bg-line")} />
              ))}
            </div>
            <span className="text-[12.5px] text-subtle">{step.label}</span>
          </div>
        )}
        <div className="rounded-[22px] bg-white p-6 shadow-[0_18px_48px_-24px_#1416132e] outline outline-1 -outline-offset-1 outline-line sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export const field = "flex flex-col gap-1.5";
export const labelCls = "text-[13px] font-medium text-ink-2";
export const inputCls =
  "h-11 w-full rounded-xl bg-white px-3.5 text-[15px] text-ink outline outline-1 -outline-offset-1 outline-line placeholder:text-faint focus:outline-2 focus:outline-brand";
export const primaryBtn =
  "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50";
