import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Badge, Card, PageHeader, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import { buyCredits } from "@/lib/actions";
import { moyasarIsLive, moyasarKey } from "@/lib/billing/moyasar";
import { PACKAGES } from "@/lib/billing/packages";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · intro" };

const REASON: Record<string, { en: string; ar: string }> = {
  purchase: { en: "Credits purchased", ar: "شراء رصيد" },
  grant: { en: "Credits granted", ar: "رصيد ممنوح" },
  search: { en: "Search", ar: "بحث" },
  request: { en: "Request (goal → list)", ar: "طلب (هدف إلى قائمة)" },
  refund_request: { en: "Request refunded (nobody found)", ar: "استرجاع طلب (ما لقينا أحدًا)" },
  refund_search: { en: "Search refunded (nothing found)", ar: "استرجاع بحث (بدون نتائج)" },
  reveal: { en: "Email reveal", ar: "كشف بريد" },
  refund_reveal: { en: "Reveal refunded (not found)", ar: "استرجاع كشف (ما لقيناه)" },
  send: { en: "First email sent", ar: "إرسال رسالة أولى" },
  refund_bounce: { en: "Refund: bounced", ar: "استرجاع: رسالة مرتدة" },
  refund_suppressed: { en: "Refund: opted out", ar: "استرجاع: إلغاء اشتراك" },
  bonus_accept: { en: "Bonus: intro accepted", ar: "مكافأة: قبول تعارف" },
};

const C = {
  en: {
    title: "Credits & billing", sub: "One balance for everything: searches, verified emails and first messages.",
    balance: "Your balance", credits: "credits",
    costs: [["search", "Search", "1 credit — refunded if nothing is found; repeating your own search within days is free"], ["target", "Request", "5 credits — a full search for your goal; refunded if we find nobody"], ["mail", "Verified email", "1 credit — refunded if we can't find one; once per person"], ["send", "First email", "1 credit — refunded if it bounces"]],
    month: "This month", used: { searches: "Searches", reveals: "Verified emails", requests: "Requests", sends: "First emails" },
    refundedN: (n: number) => `${n} refunded`, freeN: (n: number) => `${n} free repeats`, addedN: (n: number) => `${n} added`,
    need: "You need 5 credits to run a request. Top up, then confirm your brief again.",
    econ: "Platform economics · last 30 days", econRows: { searches: "Searches", cached: "Answered from cache", empty: "Found nothing", treg: "treg spend", revenue: "Revenue", sold: "Credits sold", usedC: "Credits used", cache: "Cache entries / hits" },
    packs: "Top up", per: (n: number) => `${n} credits`, unit: (sar: number, c: number) => `${(sar / c).toFixed(2)} SAR per credit`, popular: "Most popular",
    buy: "Buy with mada, card or Apple Pay", buying: "Opening secure checkout…", request: "Request this pack", requesting: "Sending…",
    soon: "Card payments are being switched on. Choosing a pack notifies our team, who'll add the credits to your account — usually the same day.",
    requested: "Request sent — we'll add the credits and email you.",
    history: "Recent activity", none: "No activity yet.", secure: "Payments are processed securely by Moyasar. We never see your card details.",
    vat: "Prices in Saudi riyals.",
  },
  ar: {
    title: "الرصيد والفواتير", sub: "رصيد واحد لكل شيء: البحث، والبريد الموثّق، والرسائل الأولى.",
    balance: "رصيدك", credits: "رصيد",
    costs: [["search", "البحث", "رصيد واحد، ويُسترجع إذا ما لقينا شيئًا، وتكرار بحثك خلال أيام مجاني"], ["target", "الطلب", "٥ أرصدة: بحث كامل لهدفك، وتُسترجع إذا ما لقينا أحدًا"], ["mail", "البريد الموثّق", "رصيد واحد، ويُسترجع إذا ما لقيناه، ومرة وحدة لكل شخص"], ["send", "الرسالة الأولى", "رصيد واحد، ويُسترجع إذا ارتدّت"]],
    month: "هذا الشهر", used: { searches: "عمليات البحث", reveals: "البريد الموثّق", requests: "الطلبات", sends: "الرسائل الأولى" },
    refundedN: (n: number) => `${n} مسترجع`, freeN: (n: number) => `${n} تكرار مجاني`, addedN: (n: number) => `أُضيف ${n}`,
    need: "تحتاج ٥ أرصدة لتشغيل الطلب. اشحن رصيدك، ثم أكّد الملخص مرة ثانية.",
    econ: "اقتصاديات المنصة · آخر ٣٠ يومًا", econRows: { searches: "عمليات البحث", cached: "من الذاكرة المؤقتة", empty: "بدون نتائج", treg: "تكلفة treg", revenue: "الإيرادات", sold: "أرصدة مباعة", usedC: "أرصدة مستخدمة", cache: "مدخلات الذاكرة / الإصابات" },
    packs: "اشحن رصيدك", per: (n: number) => `${n} رصيد`, unit: (sar: number, c: number) => `${(sar / c).toFixed(2)} ريال للرصيد`, popular: "الأكثر طلبًا",
    buy: "ادفع بمدى أو البطاقة أو Apple Pay", buying: "نفتح صفحة الدفع الآمنة…", request: "اطلب هذي الباقة", requesting: "نرسل…",
    soon: "الدفع بالبطاقة قيد التفعيل. اختيارك للباقة يرسل طلبًا لفريقنا، ويضيفون الرصيد لحسابك عادةً في نفس اليوم.",
    requested: "وصلنا طلبك، ونضيف الرصيد ونراسلك.",
    history: "آخر الحركات", none: "ما فيه حركات بعد.", secure: "المدفوعات تتم بأمان عبر ميسّر، وما نطّلع على بيانات بطاقتك.",
    vat: "الأسعار بالريال السعودي.",
  },
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ lang?: string; requested?: string; need?: string; next?: string }> }) {
  const { lang: l, requested, need, next } = await searchParams;
  const account = await pageAccount("/billing");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const [credits, ledger, usage] = await Promise.all([repo.creditBalance(account.id), repo.recentLedger(account.id), repo.usageThisMonth(account.id)]);
  const econ = account.role === "admin" ? await repo.platformEconomics() : null;
  const live = Boolean(moyasarKey());
  const testMode = live && !moyasarIsLive();

  return (
    <AppShell account={account} lang={lang} on="billing" credits={credits}>
      <div className="flex flex-col gap-7">
        <PageHeader title={t.title} sub={t.sub} />
        {requested && <Tip icon="check-circle" title={t.requested}>{""}</Tip>}
        {need === "request" && <Tip icon="target" tone="peach" action={next && next.startsWith("/") ? <a href={next} className="text-[13.5px] font-medium text-brand">{lang === "ar" ? "ارجع للطلب" : "Back to the request"}</a> : undefined}>{t.need}</Tip>}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col justify-between gap-5 rounded-[18px] bg-brand p-6 text-white">
            <span className="text-[13px] text-white/70">{t.balance}</span>
            <span className="font-display text-[56px] leading-none font-medium tracking-[-2px]"><span data-credits>{credits}</span> <span className="text-[18px] tracking-normal text-white/70">{t.credits}</span></span>
            <span className="text-[12.5px] text-white/60">{t.vat}</span>
          </div>
          <Card className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {t.costs.map(([icon, k, v]) => (
              <div key={k} className="flex flex-col gap-2 rounded-[14px] bg-surface-3 p-4">
                <span className="flex size-8 items-center justify-center rounded-[9px] bg-mint text-brand"><Icon name={icon as "search"} size={15} /></span>
                <strong className="text-[14.5px] text-ink">{k}</strong>
                <span className="text-[13px] leading-[19px] text-muted rtl:leading-[22px]">{v}</span>
              </div>
            ))}
          </Card>
        </div>

        <Card as="section" className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold text-ink">{t.month}</h2>{usage.added > 0 && <Badge tone="success">{t.addedN(usage.added)}</Badge>}</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              [t.used.searches, usage.searches, [usage.searchesRefunded && t.refundedN(usage.searchesRefunded), usage.searchesFree && t.freeN(usage.searchesFree)].filter(Boolean).join(" · ")],
              [t.used.requests, usage.requests, ""],
              [t.used.reveals, usage.reveals, ""],
              [t.used.sends, usage.sends, ""],
            ] as const).map(([k, v, sub]) => (
              <div key={k} className="flex flex-col gap-1 rounded-[14px] bg-surface-3 p-4">
                <span className="text-[12.5px] text-subtle">{k}</span>
                <span className="font-display text-[26px] font-medium text-ink">{v} <span className="text-[13px] text-subtle">{lang === "ar" ? "رصيد" : "credits"}</span></span>
                {sub && <span className="text-[12px] text-muted">{sub}</span>}
              </div>
            ))}
          </div>
        </Card>

        {econ && (
          <Card as="section" className="flex flex-col gap-3 p-5" >
            <h2 className="text-[16px] font-semibold text-ink">{t.econ}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[14px] sm:grid-cols-4">
              {([
                [t.econRows.searches, String(econ.searches)],
                [t.econRows.cached, `${econ.cachedSearches}${econ.searches ? ` (${Math.round((econ.cachedSearches / econ.searches) * 100)}%)` : ""}`],
                [t.econRows.empty, String(econ.emptySearches)],
                [t.econRows.treg, `$${econ.tregUsd.toFixed(3)}`],
                [t.econRows.revenue, `${econ.revenueSar} SAR · ${econ.ordersPaid}`],
                [t.econRows.sold, String(econ.creditsSold)],
                [t.econRows.usedC, String(econ.creditsUsed)],
                [t.econRows.cache, `${econ.cacheEntries} / ${econ.cacheHits}`],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5"><dt className="text-[12px] text-subtle">{k}</dt><dd className="font-latin font-semibold text-ink" dir="ltr">{v}</dd></div>
              ))}
            </dl>
          </Card>
        )}

        <section className="flex flex-col gap-3.5">
          <h2 className="text-[18px] font-semibold text-ink">{t.packs}</h2>
          {!live && <Tip icon="clock" tone="sand">{t.soon}</Tip>}
          {testMode && <Tip icon="shield-check" tone="sand">{lang === "ar" ? "وضع التجربة: استخدم بطاقة اختبار ميسّر، وما يُخصم أي مبلغ حقيقي." : "Test mode: use a Moyasar test card — no real money is charged."}</Tip>}
          <ul className="grid gap-3 md:grid-cols-3">
            {PACKAGES.map((p) => (
              <li key={p.id}>
                <Card className={cx("flex h-full flex-col gap-4 p-6", "popular" in p && p.popular && "outline-2 outline-brand")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold text-ink">{p[lang]}</span>
                    {"popular" in p && p.popular && <Badge tone="brand">{t.popular}</Badge>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-[34px] leading-none font-medium tracking-[-1px] text-ink">{p.sar} <span className="text-[15px] text-muted">{lang === "ar" ? "ريال" : "SAR"}</span></span>
                    <span className="text-[14px] text-ink-2">{t.per(p.credits)}</span>
                    <span className="text-[12.5px] text-subtle">{t.unit(p.sar, p.credits)}</span>
                  </div>
                  <span className="flex-1" />
                  <form action={buyCredits}>
                    <input type="hidden" name="package" value={p.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <SubmitButton pending={live ? t.buying : t.requesting} className="w-full" testId={`buy-${p.id}`}>{live ? t.buy : t.request}</SubmitButton>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-[12.5px] text-subtle"><Icon name="lock" size={12} />{t.secure}</p>
        </section>

        <Card as="section" className="flex flex-col gap-2 p-5">
          <h2 className="pb-1 text-[16px] font-semibold text-ink">{t.history}</h2>
          {ledger.length === 0 ? <p className="text-[14px] text-muted">{t.none}</p> : (
            <ul className="flex flex-col divide-y divide-line-2">
              {ledger.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="text-ink">{REASON[e.reason]?.[lang] ?? e.reason}</span>
                  <span className="flex items-center gap-4">
                    <span className="font-latin text-[12.5px] text-subtle" dir="ltr">{e.at.slice(0, 16).replace("T", " ")}</span>
                    <span className={cx("w-12 text-end font-latin font-semibold", e.delta > 0 ? "text-success-ink" : "text-ink")} dir="ltr">{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
