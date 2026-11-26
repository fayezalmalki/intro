import { Geist } from "next/font/google";
import { Skeleton } from "./ui";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

/**
 * Shown while an app page loads. It mirrors the shell (header bar, title,
 * rows) so the page doesn't jump when content arrives. Direction comes from
 * the root layout (RTL), which matches most of our users.
 */
export function AppLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className={`site ${geist.variable} min-h-dvh bg-surface-3`} data-dir="rtl" aria-busy="true" aria-label="Loading">
      <div className="h-16 border-b border-line bg-white" />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 pt-8 sm:px-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line-2" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-line-2" />
        <Skeleton className="h-28" />
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}
      </div>
    </div>
  );
}
