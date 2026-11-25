import type { ReactNode } from "react";
import { Icon, cx, type IconKey } from "@/components/site/ui";

/** Shared building blocks for the self-serve app screens (site.css tokens). */

export function PageHeader({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="text-[13px] font-medium text-subtle">{eyebrow}</span>}
        <h1 className="display font-display text-[28px] leading-[1.12] font-medium tracking-[-1px] text-ink sm:text-[32px]">{title}</h1>
        {sub && <p className="max-w-[680px] text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "li" | "article" }) {
  return <As className={cx("rounded-[18px] bg-white outline outline-1 -outline-offset-1 outline-line", className)}>{children}</As>;
}

export function Btn({
  href, children, variant = "primary", icon, size = "md", className, flipIcon,
}: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; icon?: IconKey; size?: "sm" | "md"; className?: string; flipIcon?: boolean }) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors",
        size === "md" ? "h-11 px-5 text-[14.5px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "bg-white text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface",
        variant === "ghost" && "text-brand hover:bg-mint",
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === "md" ? 15 : 14} flip={flipIcon} />}
      {children}
    </a>
  );
}

const TONE = {
  neutral: "bg-surface text-ink-2",
  brand: "bg-mint text-brand",
  success: "bg-success-soft text-success-ink",
  accent: "bg-accent-soft text-accent-ink",
  sand: "bg-sand text-ink-2",
} as const;

export function Badge({ tone = "neutral", dot, children }: { tone?: keyof typeof TONE; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap", TONE[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A helper callout: what to do here, or why something is the way it is. */
export function Tip({ icon = "sparkles", title, children, tone = "mint", action }: { icon?: IconKey; title?: ReactNode; children: ReactNode; tone?: "mint" | "sand" | "peach"; action?: ReactNode }) {
  return (
    <div className={cx("flex flex-wrap items-start gap-3 rounded-[16px] px-4 py-3.5", tone === "mint" && "bg-mint", tone === "sand" && "bg-sand", tone === "peach" && "bg-peach/60")}>
      <span className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-white", tone === "peach" ? "text-accent-ink" : "text-brand")}><Icon name={icon} size={14} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[14px] leading-[21px] text-ink rtl:leading-[24px]">
        {title && <strong className="font-semibold">{title}</strong>}
        <span className="text-ink-2">{children}</span>
      </div>
      {action && <div className="self-center">{action}</div>}
    </div>
  );
}

/** An empty or blocked state that says what to do next, with starters. */
export function Empty({ icon, title, body, children }: { icon: IconKey; title: ReactNode; body: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-7">
      <span className="flex size-11 items-center justify-center rounded-[12px] bg-mint text-brand"><Icon name={icon} size={18} /></span>
      <div className="flex flex-col gap-1">
        <strong className="text-[17px] font-semibold text-ink">{title}</strong>
        <span className="max-w-[560px] text-[14.5px] leading-[22px] text-muted rtl:leading-[25px]">{body}</span>
      </div>
      {children}
    </Card>
  );
}

/** Progress through a request: done, current and pending steps. */
export function Steps({ steps }: { steps: { label: string; state: "done" | "active" | "pending" }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span className={cx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium",
            s.state === "done" && "bg-mint text-brand",
            s.state === "active" && "bg-brand text-white",
            s.state === "pending" && "bg-surface text-subtle")}>
            <Icon name={s.state === "done" ? "check" : s.state === "active" ? "circle-dot" : "circle"} size={12} />
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[14px] bg-white outline outline-1 -outline-offset-1 outline-line", className)} />;
}

/** A starter: one click into a ready search or a prefilled request. */
export function Starter({ href, icon, title, body, tone = 0 }: { href: string; icon: IconKey; title: string; body: string; tone?: number }) {
  const tones = ["bg-mint text-brand", "bg-peach text-accent-ink", "bg-sand text-ink"];
  return (
    <a href={href} className="group flex h-full items-start gap-3 rounded-[16px] bg-white p-4 outline outline-1 -outline-offset-1 outline-line transition-shadow hover:shadow-[0_14px_30px_-18px_#14161359]">
      <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tones[tone % 3])}><Icon name={icon} size={16} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] leading-[18px] text-muted rtl:leading-5">{body}</span>
      </span>
      <Icon name="arrow-right" size={14} flip className="mt-1 text-faint transition-colors group-hover:text-brand" />
    </a>
  );
}
