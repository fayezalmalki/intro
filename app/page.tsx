import Link from "next/link";
import { headers } from "next/headers";
import { Inter, Inter_Tight } from "next/font/google";
import { getSessionUser } from "@/lib/auth";
import "./landing.css";

export const dynamic = "force-dynamic";

const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--d3-body" });
const display = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], variable: "--d3-display" });

/**
 * The English landing, Direction 3 — "Introductions in. Meetings out."
 * (intro.sa · Landing · Direction 3.pdf). Outcome-first: it leads with the
 * pipeline itself and shows replies landing in inbox.sa.
 *
 * The root layout is Arabic and RTL for the app; this page sets its own
 * lang/dir. The Arabic landing lives at /ar.
 *
 * A server component with no client JavaScript: the use-case menu is a
 * <details>, the CTAs are links and a GET form.
 */
export default async function LandingPage() {
  const signedIn = Boolean(await getSessionUser(await headers()));

  return (
    <div lang="en" dir="ltr" className={`d3 ${body.variable} ${display.variable}`}>
      <header className="d3-nav d3-wrap">
        <Link href="/" className="d3-logo" aria-label="intro.sa home">
          <Mark /> <span>intro.sa</span>
        </Link>
        <nav className="d3-links" aria-label="Primary">
          <a href="#pipeline">Product</a>
          <details className="d3-menu">
            <summary>
              Use cases <Icon name="chevron" />
            </summary>
            <div className="d3-menu-panel">
              {USE_CASES.map((u) => (
                <Link key={u.label} href={`/new?q=${encodeURIComponent(u.seed)}`}>
                  <strong>{u.label}</strong>
                  <span>{u.blurb}</span>
                </Link>
              ))}
            </div>
          </details>
          <a href="#how">How it works</a>
          <a href="#start">Pricing</a>
        </nav>
        <div className="d3-actions">
          <Link href="/ar" lang="ar" className="d3-ar">العربية</Link>
          {signedIn ? (
            <Link href="/requests">My requests</Link>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
          <Link href="/new" className="d3-btn d3-btn-sm">
            {signedIn ? "New request" : "Start free"}
          </Link>
        </div>
      </header>

      <section className="d3-hero">
        <Topo className="d3-topo d3-topo-hero" seed={3} tone="var(--d3-topo-grey)" />
        <div className="d3-wrap d3-hero-copy">
          <span className="d3-badge">
            <i className="d3-dot" /> Outbound that runs while you sleep
          </span>
          <h1>
            Introductions in.
            <br />
            Meetings out.
          </h1>
          <p>
            intro.sa fills your pipeline with the right companies and people, writes every first email,
            and moves each lead forward — from found to booked.
          </p>
          <div className="d3-ctas">
            <Link href="/new" className="d3-btn">Start free</Link>
            <a href="#pipeline" className="d3-btn d3-btn-ghost">
              Watch a pipeline fill <Icon name="play" />
            </a>
          </div>
        </div>

        <div className="d3-wrap" id="pipeline">
          <div className="d3-window" role="img" aria-label="A sample pipeline: found, contacted, replied, meeting booked">
            <div className="d3-window-bar">
              <span className="d3-lights"><i /><i /><i /></span>
              <span className="d3-url"><Icon name="lock" /> app.intro.sa/pipeline</span>
            </div>
            <div className="d3-board-head">
              <div className="d3-board-title">
                <strong>Pipeline</strong>
                <span className="d3-chip"><Icon name="calendar" /> This week</span>
              </div>
              <div className="d3-filters">
                {["All goals", "Sell software", "Vendor", "Hiring", "Partners"].map((f, i) => (
                  <span key={f} className={i === 0 ? "d3-filter on" : "d3-filter"}>{f}</span>
                ))}
              </div>
            </div>
            <div className="d3-board">
              {COLUMNS.map((col) => (
                <div key={col.title} className={col.booked ? "d3-col booked" : "d3-col"}>
                  <div className="d3-col-head">
                    <span><Icon name={col.icon} /> {col.title}</span>
                    <span className="d3-count">{col.count}</span>
                  </div>
                  {col.cards.map((c) => (
                    <div key={c.company + c.person} className="d3-card">
                      <div className="d3-card-co">
                        <span className="d3-initial">{c.company[0]}</span>
                        {c.company}
                      </div>
                      <div className="d3-card-who">{c.person}</div>
                      {c.quote && <div className="d3-card-quote">“{c.quote}”</div>}
                      {c.tag && (
                        <span className={col.booked ? "d3-tag booked" : "d3-tag"}>
                          <Icon name={c.tagIcon ?? "trend"} /> {c.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="d3-wrap d3-split" id="how">
        <div className="d3-split-copy">
          <span className="d3-chip"><Icon name="inbox" /> Works with inbox.sa</span>
          <h2>Every reply lands in your inbox — with the follow-up already drafted.</h2>
          <p>
            When someone answers, the thread moves to inbox.sa. Your inbox coworker reads it, drafts the
            next step and books the meeting. You approve.
          </p>
          <ul className="d3-checks">
            {["Replies sorted by intent: yes, later, not now", "Follow-ups drafted in the same thread", "Meetings booked straight from the reply"].map((t) => (
              <li key={t}><Icon name="check" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="d3-peach">
          <Topo className="d3-topo" seed={11} tone="var(--d3-topo-peach)" />
          <div className="d3-thread">
            <div className="d3-thread-head">
              <strong>Re: Onboarding 40 new suppliers</strong>
              <span className="d3-interested"><i /> Interested</span>
            </div>
            <div className="d3-msg">
              <span className="d3-from">Reem Alshehri · reem@sahl-logistics.com</span>
              Sure — Tuesday at 11 works. Can you show how you check VAT certificates?
            </div>
            <div className="d3-msg d3-draft">
              <span className="d3-from"><Icon name="spark" /> Follow-up drafted by your inbox coworker</span>
              Great — I&apos;ve sent an invite for Tuesday 11:00 and added a two-minute VAT-check demo to the agenda.
            </div>
            <div className="d3-thread-actions">
              <span className="d3-btn d3-btn-sm"><Icon name="send" /> Approve &amp; book</span>
              <span className="d3-btn d3-btn-sm d3-btn-line">Edit</span>
            </div>
          </div>
        </div>
      </section>

      <section className="d3-wrap d3-wide" id="start">
        <div className="d3-cta">
          <Topo className="d3-topo" seed={7} tone="var(--d3-topo-mint)" />
          <h2>Fill this week&apos;s pipeline<br />before Sunday.</h2>
          {/* GETs to /new; middleware carries ?company through sign-in. */}
          <form action="/new" method="get" className="d3-cta-form">
            <Icon name="globe" />
            <input name="company" type="text" inputMode="url" placeholder="yourcompany.sa" aria-label="Your company website" />
            <button type="submit" className="d3-btn d3-btn-sm">Start free <Icon name="arrow" /></button>
          </form>
        </div>
      </section>

      <footer className="d3-foot">
        <div className="d3-wrap d3-foot-row">
          <Link href="/" className="d3-logo" aria-label="intro.sa home"><Mark /> <span>intro.sa</span></Link>
          <nav aria-label="Footer">
            <a href="#pipeline">Product</a>
            <a href="#how">Use cases</a>
            <a href="#start">Pricing</a>
            <a href="mailto:hello@intro.sa">Contact</a>
          </nav>
          <span className="d3-made">Made in Riyadh</span>
        </div>
      </footer>
    </div>
  );
}

const USE_CASES = [
  { label: "Sell to a sector", blurb: "Decision makers at Saudi insurers, banks, retailers", seed: "I sell software to Saudi insurance companies and want to reach the decision makers" },
  { label: "Get hired", blurb: "The hiring manager for the role you want", seed: "I'm looking for a product leadership role at Saudi fintech companies" },
  { label: "Hire", blurb: "Passive candidates who aren't applying", seed: "I want to hire a head of engineering in Riyadh" },
  { label: "Find partners", blurb: "Partnerships and channel leads", seed: "I'm looking for distribution partners in Saudi logistics" },
  { label: "Raise", blurb: "Investors active in Saudi early stage", seed: "I'm raising a seed round and want Saudi investors in B2B SaaS" },
];

type IconName =
  | "chevron" | "play" | "lock" | "calendar" | "search" | "send" | "reply" | "booked" | "trend"
  | "clock" | "inbox" | "check" | "spark" | "globe" | "arrow";

interface Card { company: string; person: string; tag?: string; tagIcon?: IconName; quote?: string }

const COLUMNS: { title: string; icon: IconName; count: string; booked?: boolean; cards: Card[] }[] = [
  {
    title: "Found", icon: "search", count: "1,240", cards: [
      { company: "Nakheel Foods", person: "Faisal Alotaibi · Supply Chain Director", tag: "New DC in Jeddah" },
      { company: "Tamkeen Finance", person: "Huda Alzahrani · Head of Ops", tag: "Hiring 2 ops analysts" },
      { company: "Rawabi Trade", person: "Noura Alqahtani · Vendor Onboarding", tag: "Tender open" },
    ],
  },
  {
    title: "Contacted", icon: "send", count: "320", cards: [
      { company: "Sahl Logistics", person: "Reem Alshehri · Head of Procurement", tag: "Sent Mon 09:12", tagIcon: "clock" },
      { company: "Masar Payroll", person: "Yousef Omar · Partnerships", tag: "Sent Mon 09:14", tagIcon: "clock" },
      { company: "Gulf Cold", person: "Omar Haddad · Purchasing Manager", tag: "Follow-up Thu", tagIcon: "clock" },
    ],
  },
  {
    title: "Replied", icon: "reply", count: "46", cards: [
      { company: "Sahl Logistics", person: "Reem Alshehri", quote: "Sure — Tuesday at 11 works." },
      { company: "Atlas Realty", person: "Majed Ali", quote: "Send me the deck first?" },
      { company: "Najm Holding", person: "Khalid Alharbi", quote: "Loop in our CFO, please." },
    ],
  },
  {
    title: "Meeting booked", icon: "booked", count: "12", booked: true, cards: [
      { company: "Sahl Logistics", person: "Reem Alshehri", tag: "Tue 11:00 · 30 min", tagIcon: "calendar" },
      { company: "Marsa Distribution", person: "Khalid Alharbi", tag: "Wed 14:00 · 45 min", tagIcon: "calendar" },
      { company: "Rawabi Clinics", person: "Lama Fahad", tag: "Sun 10:30 · 30 min", tagIcon: "calendar" },
    ],
  },
];

/** The intro.sa mark: two quote marks, the opening one red, the closing one green. */
function Mark() {
  return (
    <svg className="d3-mark" viewBox="0 0 34 26" aria-hidden="true">
      <circle cx="8" cy="18" r="6.5" fill="var(--d3-red)" />
      <path d="M2.6 16.5C2.4 9.6 6.2 4.4 12.4 1.8" fill="none" stroke="var(--d3-red)" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="26" cy="8" r="6.5" fill="var(--d3-green)" />
      <path d="M31.4 9.5c.2 6.9-3.6 12.1-9.8 14.7" fill="none" stroke="var(--d3-green)" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

const PATHS: Record<IconName, string> = {
  chevron: "M4 6l4 4 4-4",
  play: "M5 3.5v9l7-4.5z",
  lock: "M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v6.5h-9z",
  calendar: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3",
  search: "M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5",
  send: "M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5z",
  reply: "M2.5 3h11v8h-6l-3 2.5V11h-2z",
  booked: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3M6 10.5l1.5 1.5 3-3",
  trend: "M2 11.5l4-4 3 3 5-5M10.5 5.5H14V9",
  clock: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5",
  inbox: "M2 9l2-6h8l2 6v4.5H2zM2 9h3.5l1 2h3l1-2H14",
  check: "M3 8.5l3 3 7-7",
  spark: "M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.5 3.5l2.5 2.5M10 10l2.5 2.5M12.5 3.5L10 6M6 10l-2.5 2.5",
  globe: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5C6 12.5 5.2 10.3 5.2 8S6 3.5 8 1.5z",
  arrow: "M3 8h10M9 4l4 4-4 4",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`d3-icon d3-icon-${name}`} viewBox="0 0 16 16" aria-hidden="true">
      <path d={PATHS[name]} fill={name === "play" ? "currentColor" : "none"} stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Topographic contour lines, generated rather than shipped as an image: a few
 * "peaks", each a set of nested wobbly rings. Deterministic per seed, so the
 * server render is stable.
 */
function Topo({ seed, tone, className }: { seed: number; tone: string; className: string }) {
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const paths: string[] = [];
  for (let peak = 0; peak < 5; peak++) {
    const cx = rand() * 1200;
    const cy = rand() * 800;
    const phase = rand() * Math.PI * 2;
    const k1 = 2 + Math.floor(rand() * 3);
    const k2 = 3 + Math.floor(rand() * 4);
    for (let ring = 1; ring <= 6; ring++) {
      const r = ring * (38 + rand() * 14);
      const points: string[] = [];
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const wobble = 1 + 0.22 * Math.sin(k1 * t + phase) + 0.1 * Math.sin(k2 * t + phase * 1.7 + ring * 0.3);
        points.push(`${(cx + Math.cos(t) * r * wobble * 1.25).toFixed(1)},${(cy + Math.sin(t) * r * wobble).toFixed(1)}`);
      }
      paths.push(`M${points.join("L")}Z`);
    }
  }
  return (
    <svg className={className} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d={paths.join("")} fill="none" stroke={tone} strokeWidth="1.2" />
    </svg>
  );
}
