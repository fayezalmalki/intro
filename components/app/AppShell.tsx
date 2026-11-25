import type { ReactNode } from "react";
import { Geist, Inter_Tight } from "next/font/google";
import { Icon, Wordmark, cx, type IconKey } from "@/components/site/ui";
import type { Account } from "@/lib/types";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

export type Lang = "ar" | "en";

const NAV: { id: string; href: string; icon: IconKey; en: string; ar: string }[] = [
  { id: "search", href: "/search", icon: "search", en: "Search", ar: "البحث" },
  { id: "leads", href: "/leads", icon: "users", en: "Leads", ar: "العملاء المحتملون" },
  { id: "requests", href: "/requests", icon: "target", en: "Requests", ar: "الطلبات" },
];

/**
 * The frame for the self-serve screens (search, leads): the site's look,
 * the account's language, and the credit balance always in view.
 */
export function AppShell({
  account, lang, on, credits, children,
}: { account: Account; lang: Lang; on: "search" | "leads" | "requests"; credits: number; children: ReactNode }) {
  const rtl = lang === "ar";
  const other = rtl ? "en" : "ar";
  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} data-dir={rtl ? "rtl" : "ltr"} className={`site ${geist.variable} ${interTight.variable} min-h-dvh bg-surface-3`}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <a href={rtl ? "/ar" : "/"} aria-label="intro"><Wordmark lang={lang} /></a>
          <nav className="flex items-center gap-1" aria-label={rtl ? "التنقل" : "Primary"}>
            {NAV.map((n) => (
              <a key={n.id} href={`${n.href}?lang=${lang}`} className={cx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium transition-colors", on === n.id ? "bg-mint text-brand" : "text-muted hover:bg-surface hover:text-ink")}>
                <Icon name={n.icon} size={15} />
                <span className="hidden sm:inline">{rtl ? n.ar : n.en}</span>
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <a href={rtl ? "/leads?lang=ar" : "/leads?lang=en"} className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 sm:flex" title={rtl ? "رصيدك لكشف البريد والإرسال" : "Credits for email reveals and sends"}>
            <Icon name="sparkles" size={13} className="text-accent" />
            <span data-credits>{credits}</span>{rtl ? " رصيد" : " credits"}
          </a>
          {account.state === "observer" && (
            <a href="/activate" className="hidden rounded-full px-3 py-1.5 text-[13px] font-medium text-brand outline outline-1 -outline-offset-1 outline-brand/30 hover:bg-mint md:block">
              {account.activationRequestedAt ? (rtl ? "التفعيل قيد المراجعة" : "Activation pending") : rtl ? "فعّل الإرسال" : "Activate sending"}
            </a>
          )}
          <a href={`?lang=${other}`} lang={other} className={cx("text-[13px] font-medium text-muted hover:text-ink", rtl ? "font-latin" : "font-ar")}>{rtl ? "EN" : "ع"}</a>
          <a href="/signout" className="flex size-8 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink" title={rtl ? "تسجيل الخروج" : "Sign out"}>
            {account.initial}
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
