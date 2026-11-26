import type { ReactNode } from "react";
import { Geist, Inter_Tight } from "next/font/google";
import { Icon, Wordmark, type IconKey } from "@/components/site/ui";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

/**
 * Not-found and error screens. They can't know the visitor's language (no
 * session, no query on a 404), so they say it in both — Arabic first.
 */
export function StatusPage({ icon, ar, en, children }: { icon: IconKey; ar: { title: string; body: string }; en: { title: string; body: string }; children: ReactNode }) {
  return (
    <div dir="rtl" data-dir="rtl" lang="ar" className={`site ${geist.variable} ${interTight.variable} flex min-h-dvh flex-col bg-surface-3`}>
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-4 sm:px-6"><a href="/ar"><Wordmark lang="ar" /></a></header>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-5 px-4 pb-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-[16px] bg-mint text-brand"><Icon name={icon} size={22} /></span>
        <div className="flex flex-col gap-2">
          <h1 className="display font-display text-[28px] font-medium text-ink">{ar.title}</h1>
          <p className="text-[15px] leading-[26px] text-muted">{ar.body}</p>
        </div>
        <div className="flex flex-col gap-1" dir="ltr" lang="en">
          <p className="text-[15px] font-semibold text-ink">{en.title}</p>
          <p className="text-[13.5px] leading-[20px] text-subtle">{en.body}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">{children}</div>
      </main>
    </div>
  );
}

export const statusBtn = "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-[14.5px] font-medium";
