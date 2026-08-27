import Link from "next/link";
import type { Account, Fit } from "@/lib/types";
import { isAccountManager } from "@/lib/session";

/**
 * Both bars take the signed-in account rather than naming anyone. They used to
 * print the two seeded demo people — "ريم" above every account manager's work,
 * the avatar "F" above every requester's — which survived the move to real
 * sign-ins because auth never touched the presentation layer.
 */
export function AmBar({ on, account }: { on?: "queue" | "team"; account: Account }) {
  return (
    <div className="bar">
      <div className="bar-left">
        <Link href="/am" className="logo">
          intro<span>.</span>
        </Link>
        <nav className="bar-nav">
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
      </div>
      <div className="row g10">
        <span className="sm muted bar-who">
          {account.displayName} · {ROLE_LABEL[account.role]}
        </span>
        <div className="avatar">{account.initial}</div>
        <SignOut />
      </div>
    </div>
  );
}

export function AppBar({ account }: { account: Account }) {
  return (
    <div className="bar">
      <div className="bar-left">
        <Link href="/" className="logo">
          intro<span>.</span>
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
  strong: { label: "توافق قوي", color: "var(--accent)", dot: "#4F6B4C" },
  medium: { label: "يستحق التجربة", color: "var(--ink-2)", dot: "#C9C9C2" },
  possible: { label: "احتمال توافق", color: "var(--ink-2)", dot: "#E0E0DA" },
};

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
        <span className="logo" style={{ fontSize: 22 }}>
          intro<span>.</span>
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
