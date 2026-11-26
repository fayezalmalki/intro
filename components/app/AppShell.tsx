import type { ReactNode } from "react";
import { Geist, Inter_Tight } from "next/font/google";
import { Icon, Wordmark, cx, type IconKey } from "@/components/site/ui";
import type { Account } from "@/lib/types";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

export type Lang = "ar" | "en";

const NAV: { id: string; href: string; icon: IconKey; en: string; ar: string }[] = [
  { id: "home", href: "/home", icon: "home", en: "Home", ar: "الرئيسية" },
  { id: "search", href: "/search", icon: "search", en: "Search", ar: "البحث" },
  { id: "leads", href: "/leads", icon: "users", en: "Leads", ar: "العملاء المحتملون" },
  { id: "requests", href: "/requests", icon: "file-text", en: "Requests", ar: "الطلبات" },
];

/**
 * The frame for the self-serve screens (search, leads): the site's look,
 * the account's language, and the credit balance always in view.
 */
export function AppShell({
  account, lang, on, credits, children,
}: { account: Account; lang: Lang; on: "home" | "search" | "leads" | "requests"; credits: number; children: ReactNode }) {
  const rtl = lang === "ar";
  const other = rtl ? "en" : "ar";
  return (
    <div lang={lang} dir={rtl ? "rtl" : "ltr"} data-dir={rtl ? "rtl" : "ltr"} className={`site ${geist.variable} ${interTight.variable} min-h-dvh bg-surface-3`}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-6">
          <a href={`/home?lang=${lang}`} aria-label={rtl ? "الرئيسية" : "Home"} className="shrink-0"><Wordmark lang={lang} className={rtl ? "h-[28px] sm:h-[34px]" : "h-[22px] sm:h-[26px]"} /></a>
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label={rtl ? "التنقل" : "Primary"}>
            {NAV.map((n) => (
              <a key={n.id} href={`${n.href}?lang=${lang}`} aria-current={on === n.id ? "page" : undefined} title={rtl ? n.ar : n.en} className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[14px] font-medium transition-colors md:px-3", on === n.id ? "bg-mint text-brand" : "text-muted hover:bg-surface hover:text-ink")}>
                <Icon name={n.icon} size={15} />
                <span className="hidden md:inline">{rtl ? n.ar : n.en}</span>
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <a href={`/billing?lang=${lang}`} className="hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-hover sm:flex" title={rtl ? "رصيدك للبحث وكشف البريد والإرسال · اشحن" : "Credits for searches, reveals and sends · top up"}>
            <Icon name="sparkles" size={13} className="text-accent" />
            <span data-credits>{credits}</span>{rtl ? " رصيد" : " credits"}
          </a>
          {account.state === "observer" && (
            <a href="/activate" className="hidden rounded-full px-3 py-1.5 text-[13px] font-medium text-brand outline outline-1 -outline-offset-1 outline-brand/30 hover:bg-mint md:block">
              {account.activationRequestedAt ? (rtl ? "التفعيل قيد المراجعة" : "Activation pending") : rtl ? "فعّل الإرسال" : "Activate sending"}
            </a>
          )}
          <a href={`/new?lang=${lang}`} className="hidden h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-medium text-white hover:bg-brand-2 lg:flex">
            <Icon name="plus" size={13} />{rtl ? "طلب جديد" : "New request"}
          </a>
          <a href={`?lang=${other}`} lang={other} className={cx("text-[13px] font-medium text-muted hover:text-ink", rtl ? "font-latin" : "font-ar")}>{rtl ? "EN" : "ع"}</a>
          <a href="/signout" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-semibold text-ink" title={rtl ? "تسجيل الخروج" : "Sign out"}>
            {account.initial}
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
