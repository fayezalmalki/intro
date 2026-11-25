import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/site/types";
import { Container, Contour, Icon, PillLink, Wordmark, cx, isLatin } from "./ui";

const h2 = "display font-display text-[34px] leading-[1.08] font-medium tracking-[-1.2px] text-ink sm:text-[44px] sm:tracking-[-1.8px]";

export function Sectors({ t }: { t: Dictionary }) {
  return (
    <section aria-label={t.sectors.lead} className="border-y border-line-2 bg-surface-3">
      <Container className="flex flex-wrap items-center gap-x-7 gap-y-2.5 py-5">
        <span className="text-[13px] font-medium text-subtle">{t.sectors.lead}</span>
        {t.sectors.items.map((s) => (
          <span key={s} className="text-[14.5px] font-medium text-ink-2">{s}</span>
        ))}
      </Container>
    </section>
  );
}

export function Statement({ t }: { t: Dictionary }) {
  return (
    <section aria-labelledby="statement-heading" className="pt-24 pb-4 lg:pt-[130px]">
      <Container className="flex flex-col gap-[18px]">
        <h2 id="statement-heading" className="display font-display text-[40px] leading-[1.04] font-medium tracking-[-1.6px] text-ink sm:text-[60px] sm:leading-[62px] sm:tracking-[-2.6px]">
          <span className="block">{t.statement.heading[0]}</span>
          <span className="block text-subtle">{t.statement.heading[1]}</span>
        </h2>
        <p className="max-w-[640px] text-[18px] leading-[28px] text-muted rtl:leading-[31px]">{t.statement.body}</p>
      </Container>
    </section>
  );
}

const TILE = ["bg-mint text-brand", "bg-peach text-accent-ink", "bg-sand text-ink", "bg-mint text-brand", "bg-peach text-accent-ink", "bg-sand text-ink"];

export function UseCases({ t }: { t: Dictionary }) {
  const u = t.useCases;
  const card = (x: (typeof u.items)[number], i: number) => (
    <li key={x.id}>
      <a href={`#demo-${x.id}`} className="flex h-full flex-col gap-4 rounded-[22px] bg-white p-6 outline outline-1 -outline-offset-1 outline-line transition-shadow hover:shadow-card">
        <span className={cx("flex size-12 items-center justify-center rounded-[14px]", TILE[i])}>
          <Icon name={x.icon} size={18} />
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="display font-display text-[21px] font-medium tracking-[-0.5px] text-ink">{x.name}</span>
          <span className="text-[15px] leading-[22px] text-muted rtl:leading-[25px]">{x.job}</span>
        </span>
        <span className="flex-1" />
        <span className="flex flex-col gap-2 border-t border-line pt-3.5">
          <span className="text-[13px] text-subtle">{x.example}</span>
          <span className="flex items-center justify-between">
            <span className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2">{x.route}</span>
            <Icon name="arrow-right" flip className="text-ink" />
          </span>
        </span>
      </a>
    </li>
  );
  return (
    <section id="use-cases" aria-labelledby="use-cases-heading" className="pt-20 lg:pt-[110px]">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <h2 id="use-cases-heading" className={h2}>{u.heading}</h2>
          <p className="text-[17px] text-muted">{u.body}</p>
        </div>
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[14px] font-medium text-subtle">{u.teams}</h3>
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">{u.items.slice(0, 4).map(card)}</ul>
        </div>
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[14px] font-medium text-subtle">{u.individuals}</h3>
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {u.items.slice(4).map((x, i) => card(x, i + 4))}
            <li className="relative flex min-h-[260px] flex-col justify-between gap-6 overflow-hidden rounded-[22px] bg-brand p-6 lg:col-span-2">
              <Contour seed={21} stroke="#ffffff14" />
              <div className="relative flex flex-col gap-2.5">
                <h4 className="display font-display text-[26px] font-medium tracking-[-0.6px] text-white">{u.guide.title}</h4>
                <p className="max-w-[420px] text-[15px] leading-[23px] text-white/75">{u.guide.body}</p>
              </div>
              <a href="/new" className="relative flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-ink hover:bg-surface">
                {u.guide.action}
                <Icon name="arrow-right" flip />
              </a>
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}

function StoryRow({ id, chip, chipIcon, heading, body, rows, panel, flip }: {
  id: string; chip: string; chipIcon: Parameters<typeof Icon>[0]["name"]; heading: string; body: string; rows: string[];
  panel: ReactNode; flip?: boolean;
}) {
  return (
    <div id={id} className="grid scroll-mt-8 items-center gap-10 lg:grid-cols-2 lg:gap-14">
      <div className={cx("flex flex-col items-start gap-[18px]", flip && "lg:order-2")}>
        <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-ink-2 outline outline-1 -outline-offset-1 outline-line">
          <Icon name={chipIcon} size={13} />
          {chip}
        </span>
        <h3 className="display font-display text-[30px] leading-[1.08] font-medium tracking-[-1.2px] text-ink sm:text-[38px] sm:tracking-[-1.7px]">{heading}</h3>
        <p className="max-w-[460px] text-[16px] leading-[26px] text-muted rtl:leading-[29px]">{body}</p>
        <ul className="w-full border-t border-line">
          {rows.map((r) => (
            <li key={r} className="flex items-center gap-2.5 border-b border-line py-3 text-[14.5px] font-medium text-ink">
              <Icon name="check" size={15} className="text-brand" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      {panel}
    </div>
  );
}

function Panel({ tone, seed, children }: { tone: "mint" | "peach" | "sand"; seed: number; children: ReactNode }) {
  const stroke = tone === "peach" ? "#b05c4247" : tone === "mint" ? "#2f6b4f29" : "#8a6d3a2e";
  return (
    <div className={cx("relative grid min-h-[420px] place-items-center overflow-hidden rounded-[22px] px-4 py-12 sm:px-10", tone === "mint" && "bg-mint", tone === "peach" && "bg-peach", tone === "sand" && "bg-sand")}>
      <Contour seed={seed} stroke={stroke} />
      <div className="relative w-full max-w-[420px]">{children}</div>
    </div>
  );
}

export function Stories({ t }: { t: Dictionary }) {
  const s = t.stories;
  const ev = s.evidence.card;
  const intro = s.intro.card;
  const ib = s.inbox.card;
  return (
    <section id="stories" aria-labelledby="stories-heading" className="pt-24 lg:pt-[130px]">
      <Container className="flex flex-col gap-20 lg:gap-28">
        <h2 id="stories-heading" className={cx(h2, "max-w-[720px]")}>{s.heading}</h2>

        <StoryRow
          id="evidence" chip={s.evidence.chip} chipIcon="file-text" heading={s.evidence.heading} body={s.evidence.body} rows={s.evidence.rows}
          panel={
            <Panel tone="mint" seed={5}>
              <div className="flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-note" aria-hidden="true">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-ink">{ev.name}</span>
                    <span className="text-[12px] text-muted">{ev.role}</span>
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap text-success-ink">
                    <span className="size-1.5 rounded-full bg-success" />{ev.fit}
                  </span>
                </div>
                <p className="text-[13px] leading-5 text-ink rtl:leading-[22px]">{ev.why}</p>
                {ev.sources.map((src) => (
                  <div key={src.title} className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 px-3 py-2.5">
                    <Icon name="link" size={13} className="text-brand" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{src.title}</span>
                    <span className={cx("shrink-0 text-[11px] text-subtle", isLatin(src.source) && "font-latin")}>{src.source} · {src.date}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12px] text-accent-ink outline outline-1 -outline-offset-1 outline-accent-soft">
                  <Icon name="ban" size={13} />
                  {ev.blocked}
                </div>
              </div>
            </Panel>
          }
        />

        <StoryRow
          id="intros" flip chip={s.intro.chip} chipIcon="handshake" heading={s.intro.heading} body={s.intro.body} rows={s.intro.rows}
          panel={
            <Panel tone="sand" seed={13}>
              <div className="flex flex-col gap-3 rounded-[14px] bg-white p-4 shadow-note" aria-hidden="true">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-mint text-brand"><Icon name="handshake" size={14} /></span>
                  <span className="text-[13.5px] font-semibold text-ink">{intro.subject}</span>
                </div>
                <span className="text-[11.5px] text-subtle">{intro.from}</span>
                <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px] leading-5 text-ink rtl:leading-[22px]">{intro.body}</p>
                <div className="flex gap-2">
                  <span className="flex items-center gap-[7px] rounded-[10px] bg-brand px-3.5 py-2 text-[12.5px] font-medium text-white"><Icon name="check" size={13} />{intro.accept}</span>
                  <span className="rounded-[10px] bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink outline outline-1 -outline-offset-1 outline-pip">{intro.decline}</span>
                </div>
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted"><Icon name="shield-check" size={12} />{intro.note}</span>
              </div>
            </Panel>
          }
        />

        <StoryRow
          id="inbox" chip={s.inbox.chip} chipIcon="inbox" heading={s.inbox.heading} body={s.inbox.body} rows={s.inbox.rows}
          panel={
            <Panel tone="peach" seed={11}>
              <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-4 shadow-[0_30px_60px_-30px_#78321e59]" aria-hidden="true">
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[13.5px] font-semibold text-ink">{ib.subject}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-medium whitespace-nowrap text-success-ink">
                    <span className="size-[5px] rounded-full bg-success" />{ib.badge}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-[10px] bg-surface px-3 py-2.5">
                  <span className="text-[11px] text-subtle" dir="auto">{ib.from}</span>
                  <span className="text-[13px] leading-5 text-ink rtl:leading-[22px]">{ib.reply}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-[10px] px-3 py-2.5 outline outline-1 -outline-offset-1 outline-line">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2"><Icon name="sparkles" size={12} className="text-accent" />{ib.draftLabel}</span>
                  <span className="text-[13px] leading-5 text-ink rtl:leading-[22px]">{ib.draft}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="flex items-center gap-[7px] rounded-full bg-brand px-3 py-[7px] text-[12.5px] font-medium text-white"><Icon name="send" size={12} flip />{ib.approve}</span>
                  <span className="rounded-full bg-white px-3 py-[7px] text-[12.5px] font-medium text-ink outline outline-1 -outline-offset-1 outline-pip">{ib.edit}</span>
                </div>
              </div>
            </Panel>
          }
        />
      </Container>
    </section>
  );
}

export function Limits({ t }: { t: Dictionary }) {
  const l = t.limits;
  return (
    <section aria-labelledby="limits-heading" className="pt-24 lg:pt-[130px]">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h2 id="limits-heading" className={h2}>{l.heading}</h2>
          <p className="text-[17px] text-muted">{l.body}</p>
        </div>
        <dl className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
          {l.items.map((s, i) => (
            <div key={s.label} className={cx("flex flex-col-reverse justify-end gap-2.5 px-4 py-6 sm:px-7 lg:py-8", i % 2 === 0 && "border-e border-line", i < 2 && "border-b border-line lg:border-b-0", i === 1 && "lg:border-e", i === 0 && "lg:ps-0")}>
              <dt className="text-[15px] leading-[22px] text-muted">{s.label}</dt>
              <dd className="font-display text-[44px] leading-[normal] tracking-[-1.6px] whitespace-nowrap text-brand sm:text-[56px] sm:tracking-[-2.4px] rtl:tracking-normal">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

const numeral = "font-display font-medium text-accent italic rtl:not-italic";

export function Principles({ t }: { t: Dictionary }) {
  const p = t.principles;
  return (
    <section id="principles" aria-labelledby="principles-heading" className="pt-24 lg:pt-[130px]">
      <Container className="flex flex-col gap-10">
        <h2 id="principles-heading" className={h2}>{p.heading}</h2>
        <div className="flex flex-col gap-3.5 lg:flex-row">
          <article className="relative flex flex-1 flex-col justify-between gap-10 overflow-hidden rounded-3xl bg-surface p-6 sm:p-10">
            <div className="relative flex flex-col gap-3.5">
              <p className={`${numeral} text-[40px]`} aria-hidden="true">{p.main.numeral}</p>
              <h3 className="display font-display text-[26px] font-medium tracking-[-0.8px] text-ink sm:text-[32px] sm:tracking-[-1px]">{p.main.title}</h3>
              <p className="max-w-[460px] text-[16px] leading-[25px] text-muted rtl:leading-[28px]">{p.main.body}</p>
            </div>
            <ul className="relative flex flex-wrap gap-2">
              {p.chips.map((c) => (
                <li key={c.label} className="flex items-center gap-[7px] rounded-full bg-white px-3.5 py-2 text-[14px] font-medium text-ink">
                  <Icon name={c.icon} className="text-brand" />
                  {c.label}
                </li>
              ))}
            </ul>
          </article>
          <div className="flex flex-col gap-3.5 lg:w-[460px]">
            {p.side.map((c) => (
              <article key={c.title} className="flex flex-1 flex-col gap-2 rounded-3xl bg-surface px-8 py-7">
                <p className={`${numeral} text-[26px]`} aria-hidden="true">{c.numeral}</p>
                <h3 className="display font-display text-[22px] font-medium tracking-[-0.5px] text-ink">{c.title}</h3>
                <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function Pricing({ t }: { t: Dictionary }) {
  const p = t.pricing;
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-6 pt-24 lg:pt-[130px]">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h2 id="pricing-heading" className={h2}>{p.heading}</h2>
          <p className="text-[17px] text-muted">{p.body}</p>
        </div>
        <ul className="grid gap-3.5 lg:grid-cols-3">
          {p.plans.map((plan) => (
            <li key={plan.name} className={cx("flex flex-col gap-5 rounded-[22px] p-7", plan.featured ? "bg-brand text-white" : "bg-white outline outline-1 -outline-offset-1 outline-line")}>
              <div className="flex flex-col gap-2">
                <span className={cx("text-[15px] font-semibold", plan.featured ? "text-white" : "text-ink")}>{plan.name}</span>
                <span className={cx("display font-display text-[40px] leading-none font-medium tracking-[-1.6px]", plan.featured ? "text-white" : "text-ink")}>{plan.price}</span>
                <span className={cx("text-[14.5px] leading-[22px]", plan.featured ? "text-white/75" : "text-muted")}>{plan.desc}</span>
              </div>
              <ul className={cx("flex flex-col border-t pt-2", plan.featured ? "border-white/15" : "border-line")}>
                {plan.features.map((f) => (
                  <li key={f} className={cx("flex items-center gap-2.5 py-2 text-[14px]", plan.featured ? "text-white" : "text-ink")}>
                    <Icon name="check" size={15} className={plan.featured ? "text-white" : "text-brand"} />
                    {f}
                  </li>
                ))}
              </ul>
              <span className="flex-1" />
              <a href={plan.href} className={cx("rounded-full px-5 py-3 text-center text-[15px] font-medium transition-colors", plan.featured ? "bg-white text-ink hover:bg-surface" : "bg-surface text-ink hover:bg-hover")}>{plan.cta}</a>
            </li>
          ))}
        </ul>
        <p className="text-[13.5px] text-muted">{p.note}</p>
      </Container>
    </section>
  );
}

export function Faq({ t }: { t: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-6 pt-24 lg:pt-[130px]">
      <Container className="flex flex-col gap-7">
        <h2 id="faq-heading" className="text-[14px] font-medium text-subtle">{t.faq.eyebrow}</h2>
        <div className="border-b border-line">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group border-t border-line">
              <summary className="flex min-h-[65px] cursor-pointer items-center justify-between gap-6 py-3 text-[17px] font-medium text-ink sm:text-[19px]">
                {item.q}
                <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-transform duration-200 group-open:rotate-45">
                  <Icon name="plus" size={14} />
                </span>
              </summary>
              <p className="max-w-[760px] pb-6 text-[16px] leading-[26px] text-muted rtl:leading-[29px]">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Invitation({ t }: { t: Dictionary }) {
  const iv = t.invitation;
  return (
    <section id="start" aria-labelledby="start-heading" className="px-3 pt-24 pb-16 sm:px-6 lg:px-12 lg:pt-[130px] lg:pb-24">
      <div className="relative mx-auto flex max-w-[1344px] flex-col items-center gap-[22px] overflow-hidden rounded-[24px] bg-mint px-5 pt-14 pb-16 text-center lg:rounded-[32px] lg:px-16 lg:pt-[88px] lg:pb-24">
        <Contour seed={7} stroke="#2f6b4f29" />
        <h2 id="start-heading" className="display relative font-display text-[36px] leading-[1.05] font-medium tracking-[-1.4px] text-balance text-ink sm:text-[54px] sm:leading-[57px] sm:tracking-[-2.4px]">
          <span className="sm:block">{iv.heading[0]}</span> <span className="sm:block">{iv.heading[1]}</span>
        </h2>
        <p className="relative text-[17px] text-ink-2">{iv.body}</p>
        {/* GETs to /new; middleware carries ?company through sign-in. */}
        <form action="/new" method="get" className="relative flex h-[54px] w-full max-w-[480px] items-center gap-2 rounded-full bg-white ps-[18px] pe-[7px] shadow-[0_10px_30px_-14px_#1d3d3359]">
          <Icon name="globe" className="text-subtle" />
          <input name="company" type="text" inputMode="url" dir="ltr" placeholder={iv.placeholder} aria-label={iv.label} className="font-latin min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle rtl:text-right" />
          <button type="submit" className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-white hover:bg-brand-2">
            {iv.submit}
            <Icon name="arrow-right" size={14} flip />
          </button>
        </form>
        <p className="relative text-[13px] text-muted">{iv.note}</p>
      </div>
    </section>
  );
}

export function Footer({ t }: { t: Dictionary }) {
  const f = t.footer;
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-col gap-12 pt-16 pb-14 md:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <Wordmark />
          <p className="text-[15px] text-ink">{f.tagline}</p>
          <p className="text-[13px] text-subtle">{f.made}</p>
        </div>
        <nav aria-label="Footer" className="contents">
          {f.columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5 md:w-[190px]">
              <h2 className="text-[15px] font-semibold text-ink">{col.title}</h2>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label} className="text-[15px] text-muted">
                    <a href={l.href} lang={l.href === "/ar" ? "ar" : l.href === "/" ? "en" : undefined} className="hover:text-ink">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
    </footer>
  );
}

