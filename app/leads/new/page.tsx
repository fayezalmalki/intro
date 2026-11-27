import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Card, PageHeader, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { createLeadAction } from "@/lib/actions";
import { STAGES, STAGE_LABEL } from "@/lib/crm";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a lead · intro" };

const C = {
  en: {
    title: "Add a lead", sub: "Someone you met, were introduced to, or found elsewhere. Track them here — no need to send anything from intro.",
    name: "Name", company: "Company", jobTitle: "Role", email: "Email", phone: "Phone", linkedin: "LinkedIn profile",
    tags: "Tags", tagsHint: "Comma-separated — e.g. event, warm, Q1", note: "Note", stage: "Stage", value: "Deal value (SAR)",
    optional: "optional", save: "Save lead", saving: "Saving…", missing: "A name and a company are needed.",
    importHint: "Have a sheet?", importCta: "Import a CSV",
  },
  ar: {
    title: "أضف عميلًا", sub: "شخص قابلته، أو أحد عرّفك عليه، أو لقيته في مكان ثاني. تابعه هنا، بدون ما تحتاج ترسل شيء من انترو.",
    name: "الاسم", company: "الشركة", jobTitle: "المنصب", email: "البريد", phone: "الجوال", linkedin: "ملف لينكدإن",
    tags: "وسوم", tagsHint: "افصل بفاصلة، مثل: معرض، دافئ، الربع الأول", note: "ملاحظة", stage: "المرحلة", value: "قيمة الصفقة (ريال)",
    optional: "اختياري", save: "احفظ العميل", saving: "نحفظ…", missing: "يلزم الاسم والشركة.",
    importHint: "عندك جدول؟", importCta: "استورد ملف CSV",
  },
};

const field = "h-11 w-full rounded-[12px] bg-surface-2 px-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ lang?: string; missing?: string }> }) {
  const { lang: l, missing } = await searchParams;
  const account = await pageAccount("/leads/new");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const credits = await repo.creditBalance(account.id);
  const F = ({ name, label, type = "text", required, dir = "auto", ph }: { name: string; label: string; type?: string; required?: boolean; dir?: string; ph?: string }) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-subtle">{label}{!required && <span className="font-normal"> · {t.optional}</span>}</span>
      <input name={name} type={type} required={required} dir={dir} placeholder={ph} className={field} />
    </label>
  );
  return (
    <AppShell account={account} lang={lang} on="leads" credits={credits}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <PageHeader title={t.title} sub={t.sub} />
        {missing && <Tip icon="target" tone="peach">{t.missing}</Tip>}
        <Card className="p-5 sm:p-6">
          <form action={createLeadAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="lang" value={lang} />
            <F name="name" label={t.name} required />
            <F name="company" label={t.company} required />
            <F name="title" label={t.jobTitle} />
            <F name="email" label={t.email} type="email" dir="ltr" />
            <F name="phone" label={t.phone} type="tel" dir="ltr" />
            <F name="linkedin" label={t.linkedin} dir="ltr" ph="linkedin.com/in/…" />
            <F name="tags" label={t.tags} ph={t.tagsHint} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-subtle">{t.stage}</span>
              <select name="stage" defaultValue="saved" className={field}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s][lang]}</option>)}
              </select>
            </label>
            <F name="value" label={t.value} dir="ltr" />
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-subtle">{t.note}<span className="font-normal"> · {t.optional}</span></span>
              <textarea name="note" rows={3} dir="auto" className="w-full rounded-[12px] bg-surface-2 p-3.5 text-[15px] text-ink outline-none focus:outline-2 focus:outline-brand" />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 sm:col-span-2">
              <a href={`/leads/import?lang=${lang}`} className="text-[13.5px] text-muted hover:text-ink">{t.importHint} <span className="font-medium text-brand">{t.importCta}</span></a>
              <SubmitButton pending={t.saving} icon="check" testId="save-lead">{t.save}</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
