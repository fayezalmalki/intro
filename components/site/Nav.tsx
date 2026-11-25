import type { Dictionary, UseCase } from "@/lib/site/types";
import { NavMenus } from "./NavMenus";
import { Container, Icon, Wordmark, cx, type IconKey } from "./ui";

const panel = "flex gap-3 rounded-[22px] bg-white p-3 shadow-[0_24px_60px_#1416131f] outline outline-1 -outline-offset-1 outline-line";
const columnTitle = "pb-2 text-[12px] font-semibold tracking-[0.6px] text-subtle uppercase rtl:tracking-normal";
const item = "flex gap-3.5 rounded-[14px] p-3 transition-colors hover:bg-surface focus-visible:bg-surface";

function Tile({ icon, tone = "mint" }: { icon: IconKey; tone?: "mint" | "peach" | "sand" }) {
  return (
    <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-[11px] text-brand", tone === "mint" && "bg-mint", tone === "peach" && "bg-peach text-accent-ink", tone === "sand" && "bg-sand")}>
      <Icon name={icon} />
    </span>
  );
}

const TONES = ["mint", "peach", "sand"] as const;

function ProductPanel({ t }: { t: Dictionary }) {
  const items = t.nav.productItems;
  return (
    <div className={panel}>
      <div className="grid flex-1 grid-cols-2 gap-0.5 px-1 py-3">
        <p className={cx(columnTitle, "col-span-2")}>{t.nav.product}</p>
        {items.map((p, i) => (
          <a key={p.name} href={p.href} className={item}>
            <Tile icon={p.icon} tone={TONES[i % 3]} />
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold text-ink">{p.name}</span>
              <span className="text-[13px] leading-[18px] text-muted rtl:leading-5">{p.desc}</span>
            </span>
          </a>
        ))}
      </div>
      <GuideCard t={t} />
    </div>
  );
}

function GuideCard({ t }: { t: Dictionary }) {
  const g = t.nav.guide;
  return (
    <div className="flex w-[280px] shrink-0 flex-col justify-between rounded-2xl bg-brand p-[22px]">
      <div className="flex flex-col gap-2">
        <p className="display font-display text-[22px] leading-[normal] font-medium tracking-[-0.4px] text-white">{g.title}</p>
        <p className="text-[14px] leading-[21px] text-white/70">{g.body}</p>
      </div>
      <a href="/new" className="flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-ink hover:bg-surface">
        {g.action}
        <Icon name="arrow-right" flip />
      </a>
    </div>
  );
}

function UseCaseLink({ u }: { u: UseCase }) {
  return (
    <a href={`#demo-${u.id}`} className={item}>
      <Tile icon={u.icon} />
      <span className="flex flex-1 flex-col gap-[3px]">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-ink">{u.name}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">{u.route}</span>
        </span>
        <span className="text-[13px] leading-[18px] text-muted rtl:leading-5">{u.example}</span>
      </span>
    </a>
  );
}

function UseCasesPanel({ t }: { t: Dictionary }) {
  const u = t.useCases.items;
  return (
    <div className={panel}>
      <div className="flex flex-1 flex-col gap-0.5 px-1 py-3">
        <p className={columnTitle}>{t.nav.teams}</p>
        {u.slice(0, 4).map((x) => <UseCaseLink key={x.id} u={x} />)}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-1 py-3">
        <p className={columnTitle}>{t.nav.individuals}</p>
        {u.slice(4).map((x) => <UseCaseLink key={x.id} u={x} />)}
      </div>
      <GuideCard t={t} />
    </div>
  );
}

export function Nav({ t, signedIn }: { t: Dictionary; signedIn: boolean }) {
  const n = t.nav;
  const home = t.locale === "ar" ? "/ar" : "/";
  const links = [
    { label: n.howItWorks, href: "#how-it-works" },
    { label: n.pricing, href: "#pricing" },
  ];
  const account = signedIn ? { label: n.myRequests, href: "/requests" } : { label: n.signIn, href: "/login" };
  const cta = signedIn ? "/new" : "/new";
  return (
    <header className="relative z-20 bg-white">
      <Container className="flex h-[76px] items-center justify-between">
        <a href={home} aria-label={n.home} className="rounded-md">
          <Wordmark />
        </a>

        <NavMenus
          label="Primary"
          menus={[
            { id: "product", label: n.product, panel: <ProductPanel t={t} /> },
            { id: "use-cases", label: n.useCases, panel: <UseCasesPanel t={t} /> },
          ]}
          links={links}
          chevrons={{ down: <Icon name="chevron-down" size={14} className="text-muted" />, up: <Icon name="chevron-up" size={14} className="text-ink" /> }}
        />

        <div className="hidden items-center gap-[18px] lg:flex">
          <a href={n.language.href} hrefLang={n.language.lang} lang={n.language.lang} className={cx("flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink", n.language.lang === "ar" ? "font-ar" : "font-latin")}>
            <Icon name="languages" />
            {n.language.label}
          </a>
          <a href={account.href} className="text-[15px] font-medium text-ink hover:text-brand-2">{account.label}</a>
          <a href={cta} className="rounded-full bg-brand px-[18px] py-2.5 text-[15px] font-medium text-white hover:bg-brand-2">{n.cta}</a>
        </div>

        {/* Mobile menu: native disclosures, no JS. */}
        <details className="group lg:hidden">
          <summary className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface text-ink" aria-label={n.menu}>
            <Icon name="menu" size={20} className="group-open:hidden" />
            <Icon name="x" size={20} className="hidden group-open:block" />
          </summary>
          <div className="absolute inset-x-0 top-[76px] max-h-[calc(100dvh-76px)] overflow-y-auto border-y border-line bg-white px-4 pt-2 pb-6 shadow-card sm:px-6">
            <details className="group/sub border-b border-line-2">
              <summary className="flex cursor-pointer items-center justify-between py-3.5 text-[16px] font-medium text-ink">
                {n.useCases}
                <Icon name="chevron-down" size={14} className="text-muted transition-transform group-open/sub:rotate-180" />
              </summary>
              <ul className="flex flex-col pb-3">
                {t.useCases.items.map((u) => (
                  <li key={u.id}>
                    <a href={`#demo-${u.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
                      <Tile icon={u.icon} />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-ink">{u.name}</span>
                        <span className="text-[13px] leading-[18px] text-muted">{u.route}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
            <ul className="flex flex-col">
              {[{ label: n.product, href: "#how-it-works" }, ...links, { label: n.faq, href: "#faq" }].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="block border-b border-line-2 py-3.5 text-[16px] font-medium text-ink">{l.label}</a>
                </li>
              ))}
              <li>
                <a href={n.language.href} hrefLang={n.language.lang} lang={n.language.lang} className="flex items-center gap-2 border-b border-line-2 py-3.5 text-[16px] font-medium text-muted">
                  <Icon name="languages" />
                  {n.language.label}
                </a>
              </li>
            </ul>
            <div className="mt-5 flex items-center gap-4">
              <a href={cta} className="flex-1 rounded-full bg-brand px-[18px] py-3 text-center text-[15px] font-medium text-white">{n.cta}</a>
              <a href={account.href} className="text-[15px] font-medium text-ink">{account.label}</a>
            </div>
          </div>
        </details>
      </Container>
    </header>
  );
}
