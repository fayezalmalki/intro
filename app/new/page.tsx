import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Card, PageHeader, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import { createRequest } from "@/lib/actions";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";
import { ar as arDict } from "@/lib/site/ar";
import { en as enDict } from "@/lib/site/en";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New request · intro" };

const C = {
  en: {
    title: "What do you want to make happen?",
    sub: "Describe the goal in a sentence — in Arabic or English. We'll confirm what we understood before we look for anyone.",
    label: "Your goal",
    placeholder: "e.g. We sell claims-automation software and want meetings with decision makers at Saudi insurers",
    go: "Continue", going: "Understanding your goal…",
    guide: "A strong request names three things",
    who: ["Who", "the role and seniority — “heads of procurement”, “C-level”"],
    where: ["Where", "the sector and market — “private hospitals in Riyadh”"],
    why: ["Why", "what you want from them — a meeting, a pilot, a role, an intro"],
    starters: "Or start from a goal", next: "What happens next",
    flow: ["We turn your sentence into a brief you confirm", "We find companies, people and this week's news", "You get ranked people with a reason and a first line"],
    browse: "Prefer to browse?", browseCta: "Search companies and people directly",
  },
  ar: {
    title: "وش تبي تحقق؟",
    sub: "اكتب هدفك في جملة، بالعربي أو بالإنجليزي. نعرض عليك اللي فهمناه قبل ما نبحث عن أي أحد.",
    label: "هدفك",
    placeholder: "مثال: نبيع برمجيات لأتمتة المطالبات ونبي اجتماعات مع أصحاب القرار في شركات التأمين السعودية",
    go: "متابعة", going: "نفهم هدفك…",
    guide: "الطلب القوي يذكر ثلاثة أشياء",
    who: ["مين", "المنصب والأقدمية، مثل «رؤساء المشتريات» أو «الإدارة التنفيذية»"],
    where: ["وين", "القطاع والسوق، مثل «المستشفيات الخاصة في الرياض»"],
    why: ["ليش", "وش تبي منهم: اجتماع، أو تجربة، أو وظيفة، أو تعارف"],
    starters: "أو ابدأ من هدف", next: "وش يصير بعدها",
    flow: ["نحوّل جملتك إلى ملخص تأكده", "نلقى الجهات والأشخاص وأخبار هذا الأسبوع", "توصلك قائمة مرتبة، ومع كل شخص سبب وأول سطر"],
    browse: "تفضّل تتصفح بنفسك؟", browseCta: "ابحث عن الجهات والأشخاص مباشرة",
  },
};

/**
 * The intake form. `?q=` carries a sentence typed on the landing or a starter
 * picked below, so nothing typed before sign-in is lost.
 */
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ q?: string; company?: string; lang?: string }> }) {
  const params = await searchParams;
  const carried = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  const account = await pageAccount(`/new${carried ? `?${carried}` : ""}`);
  const lang = pickLang(params.lang, undefined, account.locale ?? "ar");
  const t = C[lang];
  const dict = lang === "ar" ? arDict : enDict;
  const credits = await repo.creditBalance(account.id);
  const prefill = params.q?.trim() ?? "";

  return (
    <AppShell account={account} lang={lang} on="requests" credits={credits}>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <PageHeader title={t.title} sub={t.sub} />
          <Card className="p-4 sm:p-5">
            <form action={createRequest} className="flex flex-col gap-3">
              <label htmlFor="rawText" className="text-[13px] font-medium text-subtle">{t.label}</label>
              <textarea
                id="rawText" name="rawText" rows={5} required dir="auto" autoFocus={!prefill}
                defaultValue={prefill} placeholder={t.placeholder}
                className="w-full resize-y rounded-[14px] bg-surface-2 p-4 text-[16px] leading-[26px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] text-subtle">{lang === "ar" ? "ما نتواصل مع أي أحد بدون موافقتك." : "Nobody hears from us without your yes."}</span>
                <SubmitButton pending={t.going} icon="arrow-right" testId="create-request">{t.go}</SubmitButton>
              </div>
            </form>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{t.starters}</h2>
            <div className="flex flex-wrap gap-2">
              {dict.useCases.items.map((u) => (
                <a key={u.id} href={`/new?lang=${lang}&q=${encodeURIComponent(u.seed)}`}
                  className={cx("flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors", prefill === u.seed ? "bg-mint text-brand outline outline-1 -outline-offset-1 outline-brand/40" : "bg-white text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface")}>
                  <Icon name={u.icon} size={14} />{u.name}
                </a>
              ))}
            </div>
          </section>

          <Tip icon="search" title={t.browse} tone="sand" action={<a href={`/search?lang=${lang}`} className="text-[13.5px] font-medium text-brand">{t.browseCta}</a>}>
            {lang === "ar" ? "البحث المباشر يعطيك نتائج خلال ثوانٍ." : "Direct search returns results in seconds."}
          </Tip>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[14px] font-semibold text-ink">{t.guide}</h2>
            {[t.who, t.where, t.why].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="mt-0.5 h-fit rounded-full bg-mint px-2 py-0.5 text-[11.5px] font-semibold text-brand">{k}</span>
                <span className="text-[13.5px] leading-[20px] text-muted rtl:leading-[23px]">{v}</span>
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-[14px] font-semibold text-ink">{t.next}</h2>
            <ol className="flex flex-col gap-2.5">
              {t.flow.map((f, i) => (
                <li key={f} className="flex gap-3 text-[13.5px] leading-[20px] text-muted rtl:leading-[23px]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-semibold text-ink">{i + 1}</span>{f}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
