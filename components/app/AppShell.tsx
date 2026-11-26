import type { ReactNode } from "react";
import { Geist, Inter_Tight } from "next/font/google";
import { Icon, Wordmark, cx } from "@/components/site/ui";
import { NAV, SEARCH_MODES, navItems, type NavId } from "@/lib/nav";
import type { Account } from "@/lib/types";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

export type Lang = "ar" | "en";

/**
 * The frame for every signed-in screen.
 *
 * Desktop: a sidebar that reads as the app's map — Home, then Find (search and
 * its four ways, requests), then Work (leads), then the account (credits,
 * sending status, language). Phones: a slim top bar and a bottom tab bar with
 * the same destinations. Both come from lib/nav.ts.
 */
export function AppShell({
  account, lang, on, credits, mode, children,
}: { account: Account; lang: Lang; on: NavId; credits: number; mode?: string; children: ReactNode }) {
  const rtl = lang === "ar";
  const other = rtl ? "en" : "ar";
  const L = (en: string, ar: string) => (rtl ? ar : en);
  const q = `lang=${lang}`;

  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} data-dir={rtl ? "rtl" : "ltr"} className={`site ${geist.variable} ${interTight.variable} min-h-dvh bg-surface-3`}>
      {/* ── Sidebar (desktop) ── */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[256px] flex-col border-e border-line bg-white lg:flex" aria-label={L("App", "التطبيق")}>
        <div className="flex h-16 items-center px-5">
          <a href={`/home?${q}`} aria-label={L("Home", "الرئيسية")}><Wordmark lang={lang} className={rtl ? "h-[32px]" : "h-[24px]"} /></a>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <a href={`/search?${q}`} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[13.5px] font-medium text-white hover:bg-brand-2">
            <Icon name="search" size={14} />{L("Search", "ابحث")}
          </a>
          <a href={`/new?${q}`} title={L("New request", "طلب جديد")} aria-label={L("New request", "طلب جديد")} className="flex size-10 items-center justify-center rounded-full text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface">
            <Icon name="plus" size={15} />
          </a>
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4" aria-label={L("Primary", "التنقل")}>
          {NAV.map((g) => (
            <div key={g.id} className="flex flex-col gap-0.5">
              {g.en && <span className="px-3 pb-1 text-[11.5px] font-semibold tracking-[0.04em] text-subtle uppercase rtl:tracking-normal">{L(g.en, g.ar)}</span>}
              {g.items.map((n) => (
                <div key={n.id} className="flex flex-col">
                  <a href={`${n.href}?${q}`} aria-current={on === n.id ? "page" : undefined}
                    className={cx("flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors", on === n.id ? "bg-mint text-brand" : "text-ink-2 hover:bg-surface hover:text-ink")}>
                    <Icon name={n.icon} size={15} />
                    <span className="flex-1">{L(n.en, n.ar)}</span>
                    {n.id === "billing" && <span className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold text-ink-2" data-credits>{credits}</span>}
                  </a>
                  {n.id === "search" && (
                    <div className="ms-[22px] flex flex-col border-s border-line ps-2 pt-0.5">
                      {SEARCH_MODES.map((m) => (
                        <a key={m.mode} href={`/search?mode=${m.mode}&${q}`} aria-current={on === "search" && mode === m.mode ? "true" : undefined}
                          className={cx("rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors", on === "search" && mode === m.mode ? "font-medium text-brand" : "text-muted hover:bg-surface hover:text-ink")}>
                          {L(m.en, m.ar)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          {account.state === "observer" && (
            <a href={`/activate?${q}`} className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] text-muted hover:bg-surface hover:text-ink">
              <Icon name="shield-check" size={14} className="text-subtle" />
              <span className="flex-1">{account.activationRequestedAt ? L("Sending: under review", "الإرسال: قيد المراجعة") : L("Sending: not active yet", "الإرسال: غير مفعّل")}</span>
            </a>
          )}
          <div className="flex items-center gap-2.5 px-2 py-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink">{account.initial}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-ink">{account.displayName}</span>
              <span className="truncate font-latin text-[11.5px] text-subtle" dir="ltr">{account.email}</span>
            </span>
            <a href={`?lang=${other}`} lang={other} className={cx("rounded-full px-2 py-1 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-ink", rtl ? "font-latin" : "font-ar")} title={L("العربية", "English")}>{rtl ? "EN" : "ع"}</a>
            <a href="/signout" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink" title={L("Sign out", "تسجيل الخروج")} aria-label={L("Sign out", "تسجيل الخروج")}>
              <Icon name="arrow-right" size={14} flip={rtl} />
            </a>
          </div>
        </div>
      </aside>

      {/* ── Top bar (phones, tablets) ── */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <a href={`/home?${q}`} aria-label={L("Home", "الرئيسية")}><Wordmark lang={lang} className={rtl ? "h-[28px]" : "h-[21px]"} /></a>
          <span className="flex-1" />
          <a href={`/billing?${q}`} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2" title={L("Credits · top up", "الرصيد · اشحن")}>
            <Icon name="sparkles" size={13} className="text-accent" /><span data-credits>{credits}</span>
          </a>
          <a href={`?lang=${other}`} lang={other} className={cx("text-[13px] font-medium text-muted", rtl ? "font-latin" : "font-ar")}>{rtl ? "EN" : "ع"}</a>
          <a href="/signout" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink" title={L("Sign out", "تسجيل الخروج")}>{account.initial}</a>
        </div>
      </header>

      <div className="lg:ps-[256px]">
        <main className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-28 sm:px-6 lg:pt-10 lg:pb-20">{children}</main>
      </div>

      {/* ── Tab bar (phones, tablets) ── */}
      <nav aria-label={L("Primary", "التنقل")} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-[560px] grid-cols-4">
          {navItems().filter((n) => n.tab).map((n) => (
            <a key={n.id} href={`${n.href}?${q}`} aria-current={on === n.id ? "page" : undefined}
              className={cx("flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-medium", on === n.id ? "text-brand" : "text-muted")}>
              <span className={cx("flex h-7 w-12 items-center justify-center rounded-full", on === n.id && "bg-mint")}><Icon name={n.icon} size={17} /></span>
              {L(n.en, n.ar)}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
