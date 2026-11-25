import type { Dictionary } from "@/lib/site/types";
import { Container, Contour, Icon, PillLink, cx, isLatin } from "./ui";

export function Hero({ t }: { t: Dictionary }) {
  const h = t.hero;
  const b = h.board;
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative w-full">
      <div className="flex flex-col items-center px-4 pt-14 pb-12 sm:px-6 lg:pt-20">
        <div className="flex w-full max-w-[940px] flex-col items-center gap-[22px] text-center">
          <p className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 outline outline-1 -outline-offset-1 outline-line">
            <span className="size-[7px] rounded-full bg-accent" />
            <span className="text-[13.5px] font-medium text-ink">{h.pill}</span>
          </p>
          <h1
            id="hero-heading"
            className="display font-display text-[46px] leading-[1.02] font-medium tracking-[-2px] text-balance text-ink sm:text-[68px] sm:tracking-[-3px] lg:text-[84px] lg:leading-[86px] lg:tracking-[-4.4px] rtl:lg:text-[66px]"
          >
            <span className="block">{h.headline[0]}</span>
            <span className="block">{h.headline[1]}</span>
          </h1>
          <p className="max-w-[640px] text-[17px] leading-[27px] text-muted sm:text-[18px] sm:leading-[29px] rtl:sm:leading-[31px]">{h.subhead}</p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1.5">
            <PillLink href="/new" className="px-[22px] py-[13px]">{h.primary}</PillLink>
            <PillLink href="#how-it-works" variant="secondary" className="px-[22px] py-[13px]">
              {h.secondary}
              <Icon name="play" size={12} flip />
            </PillLink>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
            {h.proof.map((p) => (
              <li key={p.label} className="flex items-center gap-[7px] text-[13.5px] text-muted">
                <Icon name={p.icon} className="text-brand" />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The pipeline itself — found, contacted, replied, booked — on the contour texture. */}
      <div className="relative pb-20">
        <Contour seed={3} stroke="#14161312" className="[mask-image:linear-gradient(180deg,transparent,#000_20%,#000_75%,transparent)]" />
        <Container>
          <div
            role="img"
            aria-label={`${b.title}: ${b.columns.map((c) => `${c.title} ${c.count}`).join(", ")}`}
            className="relative overflow-hidden rounded-[16px] bg-surface-3 shadow-window outline outline-1 -outline-offset-1 outline-line"
          >
            <div aria-hidden="true">
              <div className="relative flex h-[34px] items-center border-b border-line bg-surface-2 px-3.5" dir="ltr">
                <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-pip" />)}</div>
                <span className="absolute left-1/2 flex h-[20px] w-[min(68%,640px)] -translate-x-1/2 items-center justify-center gap-1.5 rounded-md bg-white text-[11px] text-subtle outline outline-1 -outline-offset-1 outline-line">
                  <Icon name="lock" size={10} />
                  <span className="font-latin">{b.url}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pt-4 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="display font-display text-[19px] font-medium tracking-[-0.5px] text-ink">{b.title}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-ink-2 outline outline-1 -outline-offset-1 outline-line">
                    <Icon name="calendar" size={12} />
                    {b.period}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.filters.map((f, i) => (
                    <span key={f} className={cx("rounded-full px-[11px] py-1 text-[12px] font-medium", i === 0 ? "bg-brand text-white" : "bg-white text-ink outline outline-1 -outline-offset-1 outline-line")}>{f}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[repeat(4,minmax(220px,1fr))] gap-3 overflow-x-auto px-[18px] pb-[18px] [scrollbar-width:none]">
                {b.columns.map((col) => (
                  <div key={col.title} className={cx("flex flex-col gap-2 rounded-xl p-2.5", col.booked ? "bg-mint" : "bg-[#f0f0ec]")}>
                    <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <Icon name={col.icon} size={14} />
                        {col.title}
                      </span>
                      <span className="text-[12px] text-subtle">{col.count}</span>
                    </div>
                    {col.cards.map((c) => (
                      <div key={c.company + c.person} className="flex flex-col gap-1 rounded-[9px] bg-white px-[11px] py-2.5 outline outline-1 -outline-offset-1 outline-line">
                        <span className="flex items-center gap-[7px] text-[13px] font-semibold text-ink">
                          <span className="flex size-[18px] items-center justify-center rounded-[5px] bg-mint text-[10px] font-bold text-brand">{c.company[0]}</span>
                          {c.company}
                        </span>
                        <span className={cx("text-[11.5px] text-subtle", isLatin(c.person) && "font-latin")}>{c.person}</span>
                        {c.quote && <span className="text-[12.5px] text-ink">“{c.quote}”</span>}
                        {c.tag && (
                          <span className={cx("mt-1 flex w-fit items-center gap-[5px] rounded-md px-2 py-[3px] text-[11px] font-medium", col.booked ? "bg-mint text-success-ink outline outline-1 -outline-offset-1 outline-[#cfe1d4]" : "bg-surface text-ink outline outline-1 -outline-offset-1 outline-line")}>
                            {c.tagIcon && <Icon name={c.tagIcon} size={11} />}
                            {c.tag}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
