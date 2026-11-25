import { Geist, Inter_Tight } from "next/font/google";
import type { Dictionary } from "@/lib/site/types";
import { Demo } from "./Demo";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { Faq, Footer, Invitation, Limits, Pricing, Principles, Sectors, Statement, Stories, UseCases } from "./Sections";
import "../../app/site.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-inter-tight", display: "swap" });

/**
 * The intro.sa marketing site — one component, two dictionaries (lib/site/en.ts,
 * lib/site/ar.ts). Section order follows the inbox.sa landing; the look is
 * Direction 3 ("Introductions in. Meetings out.").
 *
 * The root layout is the app's (Arabic, RTL); the site root sets its own
 * lang, dir and data-dir, which drives the rtl: variant (app/site.css).
 */
export function Landing({ t, signedIn }: { t: Dictionary; signedIn: boolean }) {
  return (
    <div lang={t.locale} dir={t.dir} data-dir={t.dir} className={`site ${geist.variable} ${interTight.variable}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        {t.skip}
      </a>
      <Nav t={t} signedIn={signedIn} />
      <main id="main">
        <Hero t={t} />
        <Sectors t={t} />
        <Demo t={t} />
        <Statement t={t} />
        <UseCases t={t} />
        <Stories t={t} />
        <Limits t={t} />
        <Principles t={t} />
        <Pricing t={t} />
        <Faq t={t} />
        <Invitation t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}
