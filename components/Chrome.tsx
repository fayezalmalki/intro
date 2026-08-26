import Link from "next/link";
import type { Fit } from "@/lib/types";

export function AmBar({ on }: { on?: "queue" | "lists" }) {
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
          <span>القوائم</span>
          <span>الأشخاص</span>
        </nav>
      </div>
      <div className="row g10">
        <span className="sm muted">ريم · مديرة حسابات</span>
        <div className="avatar">R</div>
      </div>
    </div>
  );
}

export function AppBar() {
  return (
    <div className="bar">
      <div className="bar-left">
        <Link href="/" className="logo">
          intro<span>.</span>
        </Link>
        <Link href="/" className="sm muted">
          + Intro جديد
        </Link>
      </div>
      <div className="row g16 sm muted">
        <span>طلباتي</span>
        <Link href="/am" className="dim">
          لوحة مدير الحساب ←
        </Link>
        <div className="avatar">F</div>
      </div>
    </div>
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
