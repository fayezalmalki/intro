import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** 16px stroke icons (Lucide-style geometry), drawn here so the site ships no icon package. */
const PATHS = {
  "chevron-down": "M4 6l4 4 4-4",
  "chevron-up": "M4 10l4-4 4 4",
  "arrow-right": "M3 8h10M9 4l4 4-4 4",
  play: "M5 3.5v9l7-4.5z",
  lock: "M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v6.5h-9z",
  calendar: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3",
  "calendar-check": "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3M6 10.5l1.5 1.5 3-3",
  search: "M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 14l-3.5-3.5",
  send: "M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5z",
  reply: "M2.5 3h11v8h-6l-3 2.5V11h-2z",
  trend: "M2 11.5l4-4 3 3 5-5M10.5 5.5H14V9",
  clock: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5",
  inbox: "M2 9l2-6h8l2 6v4.5H2zM2 9h3.5l1 2h3l1-2H14",
  check: "M3 8.5l3 3 7-7",
  "check-circle": "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM5.5 8.2l1.8 1.8 3.4-3.6",
  circle: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z",
  "circle-dot": "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  sparkles: "M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.5 3.5l2.5 2.5M10 10l2.5 2.5M12.5 3.5L10 6M6 10l-2.5 2.5",
  globe: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5C6 12.5 5.2 10.3 5.2 8S6 3.5 8 1.5z",
  languages: "M2 3.5h7M5.5 2v1.5M3.5 3.5c.7 2.5 2.4 4.4 4.5 5.5M7.5 3.5C7 6 5.2 8.3 2.5 9.5M8.5 14l3-7 3 7M9.5 11.8h4",
  plus: "M8 3v10M3 8h10",
  briefcase: "M2 5h12v8.5H2zM5.5 5V3h5v2M2 8.5h12",
  "user-check": "M6 7.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1.5 14c0-2.5 2-4.5 4.5-4.5 1.2 0 2.3.5 3.1 1.2M10.5 12.5l1.5 1.5 3-3",
  "user-search": "M6 7.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1.5 14c0-2.5 2-4.5 4.5-4.5M12 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM13.5 13l1.2 1.2",
  handshake: "M1.5 7l3-3 3 1.5L10 4l4.5 3M1.5 7l4.5 4.5c.6.6 1.4.6 2 0L14.5 7M5 9.5l1.5-1.5M7 11l1.5-1.5M9 12.5l1-1",
  sprout: "M8 14.5V8M8 8c0-3 2-5 5.5-5 0 3.5-2 5-5.5 5zM8 10c0-2.5-1.7-4-4.5-4 0 2.8 1.7 4 4.5 4z",
  flag: "M3 14.5V2M3 2.5h8.5l-2 3 2 3H3",
  "shield-check": "M8 1.5l5.5 2v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4zM5.5 8l1.8 1.8L10.8 6.3",
  "file-text": "M4 1.5h5.5L12.5 4.5v10h-8.5zM9.5 1.5v3h3M6 8h4.5M6 10.5h4.5",
  link: "M7 9a3 3 0 0 0 4.2.3l2-2a3 3 0 0 0-4.2-4.2l-1 1M9 7a3 3 0 0 0-4.2-.3l-2 2a3 3 0 0 0 4.2 4.2l1-1",
  building: "M3 14.5v-12h7v12M10 6.5h3.5v8M1.5 14.5h13M5 5h2M5 7.5h2M5 10h2",
  users: "M6 7.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M11 1.8a3 3 0 0 1 0 5.4M12.5 9.8c1.6.6 2.5 2 2.5 4.2",
  "at-sign": "M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10.5 8v1a2 2 0 0 0 4 0V8A6.5 6.5 0 1 0 12 13.2",
  timer: "M8 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM8 6v3M6.5 1.5h3",
  ban: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM3.4 3.4l9.2 9.2",
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  x: "M4 4l8 8M12 4l-8 8",
  target: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8 8.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z",
  mail: "M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5",
} as const;

export type IconKey = keyof typeof PATHS;

export function Icon({ name, className, flip, size = 16 }: { name: IconKey; className?: string; flip?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={cx("shrink-0", flip && "rtl:-scale-x-100", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} fill={name === "play" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The intro.sa mark: an opening quote in red and a closing one in green. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 26" width={30} height={23} className={cx("shrink-0", className)} aria-hidden="true" focusable="false">
      <circle cx="8" cy="18" r="6.5" className="fill-accent" />
      <path d="M2.6 16.5C2.4 9.6 6.2 4.4 12.4 1.8" fill="none" className="stroke-accent" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="26" cy="8" r="6.5" className="fill-brand" />
      <path d="M31.4 9.5c.2 6.9-3.6 12.1-9.8 14.7" fill="none" className="stroke-brand" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The traced intro wordmark — the same mark as the dashboard (public/logo).
 * Arabic pages carry «انترو», English pages «Intro»; the language decides,
 * not the layout direction.
 */
export function Wordmark({ className, lang = "en", tone = "ink" }: { className?: string; lang?: "ar" | "en"; tone?: "ink" | "paper" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo/intro-${lang}-${tone}.svg`}
      alt={lang === "ar" ? "انترو" : "Intro"}
      className={cx("block w-auto shrink-0", lang === "ar" ? "h-[34px]" : "h-[26px]", className)}
    />
  );
}

/** Pill-shaped link used for the main CTAs. */
export function PillLink({
  variant = "primary",
  className,
  children,
  ...props
}: ComponentProps<"a"> & { variant?: "primary" | "secondary" | "light" }) {
  return (
    <a
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-medium whitespace-nowrap transition-colors",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "bg-surface text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-hover",
        variant === "light" && "bg-white text-ink hover:bg-surface",
        className,
      )}
    >
      {children}
    </a>
  );
}

/** Content column: 1120px at desktop, 16px gutters on phones. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-[1152px] px-4 sm:px-6 xl:px-4", className)}>{children}</div>;
}

export const isLatin = (s: string) => /^[\x20-\x7E‐-‟·]+$/.test(s);

/**
 * Topographic contour lines — the texture behind the hero, panels and CTA.
 * Generated (deterministic per seed) instead of shipped as images.
 */
export function Contour({ seed, className, stroke }: { seed: number; className?: string; stroke: string }) {
  let s = seed * 9301 + 49297;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  let d = "";
  for (let peak = 0; peak < 5; peak++) {
    const cx0 = rand() * 1200;
    const cy0 = rand() * 800;
    const phase = rand() * Math.PI * 2;
    const k1 = 2 + Math.floor(rand() * 3);
    const k2 = 3 + Math.floor(rand() * 4);
    for (let ring = 1; ring <= 6; ring++) {
      const r = ring * (38 + rand() * 14);
      const pts: string[] = [];
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const w = 1 + 0.22 * Math.sin(k1 * t + phase) + 0.1 * Math.sin(k2 * t + phase * 1.7 + ring * 0.3);
        pts.push(`${(cx0 + Math.cos(t) * r * w * 1.25).toFixed(1)},${(cy0 + Math.sin(t) * r * w).toFixed(1)}`);
      }
      d += `M${pts.join("L")}Z`;
    }
  }
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cx("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.2" />
    </svg>
  );
}
