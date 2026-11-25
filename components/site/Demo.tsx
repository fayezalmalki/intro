import type { Dictionary, Preview, Tone } from "@/lib/site/types";
import { DemoTabs } from "./DemoTabs";
import { Icon, PillLink, cx, isLatin } from "./ui";

const tagTone: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-surface text-muted",
  success: "bg-success-soft text-success-ink",
};
const badgeTone: Record<Tone, { bg: string; dot: string; text: string }> = {
  accent: { bg: "bg-accent-soft", dot: "bg-accent", text: "text-accent-ink" },
  neutral: { bg: "bg-surface", dot: "bg-subtle", text: "text-ink-2" },
  success: { bg: "bg-success-soft", dot: "bg-success", text: "text-success-ink" },
};

/** A request's workspace: the goal and sectors, the matches, and one person opened. */
function Workspace({ p }: { p: Preview }) {
  const d = p.detail;
  const badge = badgeTone[d.badge.tone];
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-t-[18px] bg-white outline outline-1 -outline-offset-1 outline-line md:h-[620px]">
      <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-3.5">
        <div className="flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-pip" />)}</div>
        <div className="flex h-[22px] flex-1 items-center justify-center gap-1.5 rounded-md bg-white" dir="ltr">
          <Icon name="lock" size={11} className="text-subtle" />
          <span className="font-latin text-[12px] text-muted">{p.url}</span>
        </div>
        <span className="hidden w-11 sm:block" />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[230px] shrink-0 flex-col gap-2 border-e border-line bg-surface-3 px-3 py-4 lg:flex">
          <div className="flex items-start gap-2 rounded-lg bg-white p-2.5 outline outline-1 -outline-offset-1 outline-line">
            <Icon name="target" className="mt-px text-accent" />
            <span className="text-[12.5px] leading-[17px] font-semibold text-ink">{p.goal}</span>
          </div>
          <p className="px-1 pt-2 text-[11px] font-semibold tracking-[0.5px] text-subtle uppercase rtl:tracking-normal">{p.sectorsLabel}</p>
          <div className="flex flex-wrap gap-1.5 px-1">
            {p.sectors.map((s, i) => (
              <span key={s} className={cx("rounded-full px-2.5 py-1 text-[11.5px] font-medium", i === 0 ? "bg-brand text-white" : "bg-white text-ink-2 outline outline-1 -outline-offset-1 outline-line")}>{s}</span>
            ))}
          </div>
          <p className="px-1 pt-3 text-[11px] font-semibold tracking-[0.5px] text-subtle uppercase rtl:tracking-normal">{p.routeLabel}</p>
          {p.routes.map((r) => (
            <div key={r.label} className="flex items-center gap-2 px-2 py-1.5">
              <Icon name={r.icon} size={14} className="text-brand" />
              <span className="text-[12.5px] text-ink">{r.label}</span>
            </div>
          ))}
        </aside>

        <div className="hidden w-[310px] shrink-0 flex-col border-e border-line md:flex">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <span className="text-[14px] font-semibold text-ink">{p.list.title}</span>
            <span className="text-[12px] text-subtle">{p.list.count}</span>
          </div>
          {p.list.items.map((it) => (
            <div key={it.name} className={cx("flex gap-2.5 border-b border-line-2 px-4 py-3", it.active ? "bg-surface" : "bg-white")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-avatar text-[12px] font-semibold text-ink">{it.initial}</span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="text-[13px] font-semibold text-ink">{it.name}</span>
                <span className="w-full truncate text-[12px] text-muted">{it.role}</span>
                <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", tagTone[it.tagTone])}>{it.tag}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-avatar text-[14px] font-semibold text-ink">{d.initial}</span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[15px] font-semibold text-ink">{d.name}</span>
                <span className="text-[12px] text-muted">{d.meta[0]} · {d.meta[1]}</span>
              </span>
            </div>
            <span className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1", badge.bg)}>
              <span className={cx("size-1.5 rounded-full", badge.dot)} />
              <span className={cx("text-[11.5px] font-medium", badge.text)}>{d.badge.label}</span>
            </span>
          </div>

          <dl className="grid grid-cols-3 gap-2.5">
            {d.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1 rounded-[10px] px-3 py-2.5 outline outline-1 -outline-offset-1 outline-line">
                <dt className="text-[11px] text-subtle">{f.key}</dt>
                <dd className="text-[13px] font-semibold text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center gap-2.5 rounded-[10px] bg-mint px-3 py-2.5">
            <Icon name="file-text" size={14} className="text-brand" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{d.evidence.title}</span>
            <span className={cx("shrink-0 text-[11px] text-success-ink", isLatin(d.evidence.source) && "font-latin")}>{d.evidence.source} · {d.evidence.date}</span>
          </div>

          <ol className="flex flex-col rounded-xl px-3.5 py-1 outline outline-1 -outline-offset-1 outline-line">
            {d.steps.map((s, i) => (
              <li key={s.label} className={cx("flex items-center justify-between gap-3 py-[7px]", i < d.steps.length - 1 && "border-b border-line-3")}>
                <span className="flex items-center gap-2.5">
                  <Icon name={s.state === "done" ? "check-circle" : s.state === "active" ? "circle-dot" : "circle"} size={15} className={s.state === "active" ? "text-accent" : s.state === "pending" ? "text-faint" : "text-brand"} />
                  <span className={cx("text-[13px]", s.state === "active" && "font-semibold text-ink", s.state === "done" && "text-ink", s.state === "pending" && "text-subtle")}>{s.label}</span>
                </span>
                <span className={cx("shrink-0 text-[12px]", s.state === "active" ? "font-semibold text-accent-ink" : "text-subtle")}>{s.status}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-3">
            <span className="flex items-center gap-1.5">
              <Icon name="sparkles" size={13} className="text-accent" />
              <span className="text-[11.5px] font-semibold text-muted">{d.draft.label}</span>
            </span>
            <p className="text-[13px] leading-5 text-ink rtl:leading-[22px]">{d.draft.text}</p>
          </div>

          <div className="flex gap-2">
            <span className="flex items-center gap-[7px] rounded-[10px] bg-brand px-3.5 py-[9px] text-[13px] font-medium text-white">
              <Icon name="send" size={13} flip />
              {d.primary}
            </span>
            <span className="rounded-[10px] px-3.5 py-[9px] text-[13px] font-medium text-ink outline outline-1 -outline-offset-1 outline-pip">{d.secondary}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Demo({ t }: { t: Dictionary }) {
  const d = t.demo;
  const cases = t.useCases.items;
  return (
    <section id="how-it-works" aria-labelledby="demo-heading" className="px-3 pt-16 sm:px-6 lg:px-12 lg:pt-20">
      {cases.map((u) => <span key={u.id} id={`demo-${u.id}`} aria-hidden="true" className="block scroll-mt-6" />)}
      <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-5 overflow-hidden rounded-[24px] bg-surface px-4 pt-12 sm:px-8 lg:rounded-[32px] lg:px-16 lg:pt-[72px]">
        <p className="rounded-full bg-white px-3 py-[5px] text-[13px] font-medium text-ink">{d.chip}</p>
        <h2 id="demo-heading" className="display text-center font-display text-[34px] leading-[1.1] font-medium tracking-[-1.2px] text-balance text-ink sm:text-[46px] lg:text-[54px] lg:tracking-[-2px]">
          {d.heading}
        </h2>
        <p className="max-w-[660px] text-center text-[17px] leading-[26px] text-muted rtl:leading-[29px]">{d.body}</p>
        <PillLink href="/new" className="px-5 py-3">{d.cta}</PillLink>
        <p className="flex items-center gap-2 pt-2 pb-3 text-center text-[14px] text-muted">{d.hint}</p>
        <DemoTabs
          label={d.tabsLabel}
          dir={t.dir}
          tabs={cases.map((u) => {
            const face = (selected: boolean) => (
              <>
                <span className="flex items-center gap-[7px]">
                  <Icon name={u.icon} className={selected ? "text-brand" : "text-muted"} />
                  <span className={cx("text-[13.5px] font-semibold", selected ? "text-ink" : "text-ink-2")}>{u.name}</span>
                </span>
                <span className="text-[11.5px] leading-4 text-subtle rtl:leading-[17px]">{u.route}</span>
              </>
            );
            return { id: u.id, active: face(true), idle: face(false) };
          })}
          panels={cases.map((u) => <Workspace key={u.id} p={d.previews[u.id]} />)}
        />
      </div>
    </section>
  );
}
