import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Card, PageHeader, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { importLeadsAction } from "@/lib/actions";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import leads · intro" };

const SAMPLE = "name,company,title,email,phone,linkedin,tags,stage,note\nNoura Alsaud,Lumen Pay,Head of Partnerships,noura@lumenpay.sa,+966500000000,linkedin.com/in/noura,event;warm,contacted,Met at Money20/20";

const C = {
  en: {
    title: "Import leads", sub: "Upload a CSV from Excel, Google Sheets, HubSpot or LinkedIn — or paste it. Up to 500 rows. Nobody is contacted.",
    file: "CSV file", or: "or paste it", columns: "Columns we read (any order, Arabic or English headers)",
    cols: "name*, company*, title, email, phone, linkedin, tags, stage, note, value", go: "Import", going: "Importing…",
    none: (k: number) => `No rows could be imported${k ? ` (${k} skipped)` : ""}. Each row needs a name and a company, with a header row first.`,
  },
  ar: {
    title: "استيراد العملاء", sub: "ارفع ملف CSV من إكسل أو قوقل شيتس أو HubSpot أو لينكدإن، أو الصقه. حتى ٥٠٠ صف. ما نتواصل مع أحد.",
    file: "ملف CSV", or: "أو الصقه هنا", columns: "الأعمدة اللي نقرأها (بأي ترتيب، عناوين عربية أو إنجليزية)",
    cols: "الاسم*، الشركة*، المنصب، البريد، الجوال، لينكدإن، الوسوم، المرحلة، ملاحظة، القيمة", go: "استورد", going: "نستورد…",
    none: (k: number) => `ما قدرنا نستورد أي صف${k ? ` (تخطينا ${k})` : ""}. كل صف يحتاج الاسم والشركة، وأول سطر للعناوين.`,
  },
};

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ lang?: string; none?: string; skipped?: string }> }) {
  const { lang: l, none, skipped } = await searchParams;
  const account = await pageAccount("/leads/import");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const credits = await repo.creditBalance(account.id);
  return (
    <AppShell account={account} lang={lang} on="leads" credits={credits}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <PageHeader title={t.title} sub={t.sub} />
        {none && <Tip icon="target" tone="peach">{t.none(Number(skipped ?? 0))}</Tip>}
        <Card className="p-5 sm:p-6">
          <form action={importLeadsAction} className="flex flex-col gap-4">
            <input type="hidden" name="lang" value={lang} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-subtle">{t.file}</span>
              <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-[14px] text-ink file:me-3 file:rounded-full file:border-0 file:bg-mint file:px-4 file:py-2 file:text-brand" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-subtle">{t.or}</span>
              <textarea name="csv" rows={7} dir="ltr" placeholder={SAMPLE} data-testid="import-csv"
                className="w-full rounded-[12px] bg-surface-2 p-3.5 font-mono text-[13px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand" />
            </label>
            <p className="text-[12.5px] text-subtle">{t.columns}: <span className="text-ink-2">{t.cols}</span></p>
            <div className="flex justify-end border-t border-line pt-4"><SubmitButton pending={t.going} icon="inbox" testId="import-go">{t.go}</SubmitButton></div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
