import Link from "next/link";
import type { Account, Brief, Fit, GoalType, OutreachStatus } from "@/lib/types";
import { isAccountManager } from "@/lib/session";

/**
 * Both bars take the signed-in account rather than naming anyone. They used to
 * print the two seeded demo people — "ريم" above every account manager's work,
 * the avatar "F" above every requester's — which survived the move to real
 * sign-ins because auth never touched the presentation layer.
 */
/**
 * The console shell: a fixed rail beside the work.
 *
 * The requester keeps a top bar (AppBar, below) and the console gets the rail.
 * That is not inconsistency — it is the same argument as the last design
 * review, that a 240px fixed column for two destinations is over-structure. The
 * requester has two; the console has the queue, the team, and a per-request
 * stack underneath, with people_lists already in the database waiting for a
 * screen.
 *
 * Takes the signed-in account rather than naming anyone. Both bars used to
 * print the two seeded demo people — "ريم" above every account manager's work,
 * the avatar "F" above every requester's — which survived the move to real
 * sign-ins because auth never touched the presentation layer.
 */
export function Console({
  on,
  account,
  children,
}: {
  on?: "queue" | "team";
  account: Account;
  children: React.ReactNode;
}) {
  return (
    <div className="console">
      <div className="rail">
        <Link href="/am" className="logo">
          <Wordmark on="ink" />
        </Link>
        <nav className="rail-nav">
          <Link href="/am" className={on === "queue" ? "on" : ""}>
            الطابور
          </Link>
          {/* Only admins can change roles, so only admins are shown the door. */}
          {account.role === "admin" && (
            <Link href="/am/team" className={on === "team" ? "on" : ""}>
              الفريق
            </Link>
          )}
        </nav>
        <div className="grow" />
        <div className="rail-who">
          <div className="avatar sm">{account.initial}</div>
          <div className="stack rail-who-text">
            <span className="sm" style={{ color: "#fff", fontWeight: 600 }}>
              {account.displayName}
            </span>
            <span className="xs" style={{ color: "var(--on-dark-2)" }}>
              {ROLE_LABEL[account.role]}
            </span>
          </div>
          <div className="grow" />
          <SignOut />
        </div>
      </div>
      <div className="console-main">{children}</div>
    </div>
  );
}

export function AppBar({ account }: { account: Account }) {
  return (
    <div className="bar">
      <div className="bar-left">
        <Link href="/" className="logo">
          <Wordmark />
        </Link>
        <Link href="/requests" className="sm muted">
          طلباتي
        </Link>
        <Link href="/new" className="sm muted">
          + Intro جديد
        </Link>
      </div>
      <div className="row g16 sm muted">
        {/* Only account managers see the console link. Showing it to everyone
            offered every requester a door middleware then closed on them. */}
        {isAccountManager(account) && (
          <Link href="/am" className="dim">
            لوحة مدير الحساب ←
          </Link>
        )}
        <div className="avatar">{account.initial}</div>
        <SignOut />
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<Account["role"], string> = {
  requester: "مُقدّم طلب",
  account_manager: "مدير حسابات",
  admin: "مشرف",
};

/**
 * A form, not a link: a GET sign-out fires on any prefetch of the page it sits
 * on, which would sign people out as they browsed.
 */
function SignOut() {
  return (
    <form action="/signout" method="post">
      <button type="submit" className="btn btn-ghost btn-sm" title="تسجيل الخروج">
        خروج
      </button>
    </form>
  );
}

const FIT: Record<Fit, { label: string; color: string; dot: string }> = {
  strong: { label: "توافق قوي", color: "var(--accent)", dot: "var(--accent)" },
  medium: { label: "يستحق التجربة", color: "var(--ink-2)", dot: "var(--line-2)" },
  possible: { label: "احتمال توافق", color: "var(--ink-2)", dot: "var(--line)" },
};

/**
 * The badge tones from the handoff, which assigns a specific pair per state.
 * They are not interchangeable: a solid fill means the state is terminal, a
 * tint means it is still in flight.
 */
type Tone = "" | "accent" | "warn" | "bad" | "solid" | "ink";

export function Badge({ tone = "", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

const FIT_BADGE: Record<Fit, { tone: Tone; label: string }> = {
  strong: { tone: "accent", label: "توافق قوي" },
  medium: { tone: "warn", label: "متوسط" },
  possible: { tone: "", label: "محتمل" },
};

export function FitBadge({ fit }: { fit: Fit }) {
  const f = FIT_BADGE[fit];
  return <Badge tone={f.tone}>{f.label}</Badge>;
}

/**
 * Where a person stands. Our six outreach states map onto the handoff's badge
 * tones almost exactly; "none" is its NEW, and "accepted" is its CONNECTED —
 * the only terminal good outcome, so it takes the solid ink fill.
 */
const OUTREACH_BADGE: Record<OutreachStatus, { tone: Tone; label: string } | null> = {
  none: { tone: "", label: "جديد" },
  queued: { tone: "warn", label: "في الانتظار" },
  sent: { tone: "accent", label: "تواصلنا" },
  replied: { tone: "solid", label: "ردّ" },
  accepted: { tone: "ink", label: "تم التعارف" },
  declined: { tone: "bad", label: "اعتذر" },
};

export function OutreachBadge({ status }: { status: OutreachStatus }) {
  const s = OUTREACH_BADGE[status];
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null;
}

/**
 * The handoff sorts every request into three directions. Our briefs carry five
 * goal types, so partnerships join sales, and a named person or an investor is
 * research before it is a pitch.
 */
const DIRECTION: Record<GoalType, { tone: Tone; label: string }> = {
  sales: { tone: "accent", label: "مبيعات" },
  partnership: { tone: "accent", label: "شراكات" },
  investment: { tone: "warn", label: "استثمار" },
  person: { tone: "warn", label: "شخص محدد" },
  job: { tone: "", label: "توظيف" },
};

export function DirectionBadge({ goal }: { goal: GoalType }) {
  const d = DIRECTION[goal];
  return <Badge tone={d.tone}>{d.label}</Badge>;
}

/**
 * The traced mark from the design handoff, replacing the wordmark that was set
 * as text. Two fixed-colour files rather than the currentColor master, because
 * an <img> is an isolated document and cannot inherit the page's colour.
 */
export function Wordmark({ on = "light", size }: { on?: "light" | "ink"; size?: "lg" }) {
  return (
    <img
      className={`wordmark${size ? ` ${size}` : ""}`}
      src={on === "ink" ? "/logo/intro-ar-paper.svg" : "/logo/intro-ar-ink.svg"}
      alt="Intro"
    />
  );
}

/**
 * Where a brief came from, and how sure the extractor was.
 *
 * Shared rather than repeated because the requester's confirm screen and the
 * account manager's review screen must agree: two copies of this sentence
 * would eventually say different things about the same brief. lib/intent.ts
 * falls back to a keyword extractor on a missing credential or a failed call,
 * so «قواعد محلية» is the visible symptom of a dead ANTHROPIC_API_KEY.
 */
export function Provenance({ brief }: { brief: Pick<Brief, "extractedBy" | "confidence"> }) {
  return (
    <span className="sm dim">
      استُخرج بـ{brief.extractedBy === "claude" ? "Claude" : "قواعد محلية"} · ثقة{" "}
      {ar(Math.round(brief.confidence * 100))}٪
    </span>
  );
}

export function FitTag({ fit }: { fit: Fit }) {
  const f = FIT[fit];
  return (
    <span className="row g6">
      <span className="dot" style={{ background: f.dot }} />
      <span className="sm" style={{ color: f.color }}>
        {f.label}
      </span>
    </span>
  );
}

export function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" style={{ flex: "none" }}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

export function Check() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Arabic-Indic numerals, matching the rest of the interface. */
export function ar(n: number | string): string {
  return String(n)
    .split("")
    .map((d) => (/\d/.test(d) ? DIGITS[+d] : d))
    .join("");
}

/**
 * Shown when someone signed in reaches a screen their role does not cover.
 * Deliberately not an error page: nothing went wrong, and saying so invites a
 * pointless retry and a support message.
 */
export function Forbidden({ area }: { area: string }) {
  return (
    <div className="login-page">
      <div className="stack g16 narrow" style={{ width: "100%", textAlign: "center" }}>
        <span className="logo lg">
          <Wordmark />
        </span>
        <h1>هذي الصفحة مو ضمن صلاحياتك.</h1>
        <span className="sm muted">{area}</span>
        <div className="row g10" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">
            رجوع للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
