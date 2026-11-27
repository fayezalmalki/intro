import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Card, PageHeader, Tip } from "@/components/app/ui";
import { pickLang } from "@/components/site/AuthShell";
import { Icon } from "@/components/site/ui";
import { deleteAccountAction, updateSettingsAction } from "@/lib/actions";
import * as repo from "@/lib/db/repo";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · intro" };

const C = {
  en: {
    title: "Settings", sub: "Your profile, the emails we send you, and your data.",
    profile: "Profile", profileSub: "Used in the first lines we draft for you.", name: "Name", jobTitle: "Role", company: "Company", website: "Company website", linkedin: "LinkedIn profile",
    language: "Language", ar: "العربية", en: "English",
    emails: "Emails", results: "When a request's list is ready", reminders: "Daily reminder of follow-ups and next steps due",
    signIn: (e: string) => `You sign in with ${e} using a one-time code.`,
    save: "Save", saving: "Saving…", saved: "Saved.",
    data: "Your data", dataSub: "Download everything we hold about you — profile, leads, notes, requests, credits — as a file.", download: "Download my data",
    danger: "Delete account", dangerSub: "Deletes your account, leads, notes, requests and credits for good. Payment records are kept as the law requires. This can't be undone.",
    confirmLabel: (e: string) => `Type ${e} to confirm`, deleteGo: "Delete my account", deleting: "Deleting…", mismatch: "That isn't your email — nothing was deleted.",
    legal: "Privacy policy", terms: "Terms",
  },
  ar: {
    title: "الإعدادات", sub: "ملفك، والرسائل اللي نرسلها لك، وبياناتك.",
    profile: "ملفك", profileSub: "نستخدمه في أول سطر نكتبه لك.", name: "الاسم", jobTitle: "المنصب", company: "الشركة", website: "موقع الشركة", linkedin: "ملف لينكدإن",
    language: "اللغة", ar: "العربية", en: "English",
    emails: "الرسائل", results: "لما تجهز قائمة أي طلب", reminders: "تذكير يومي بالمتابعات والخطوات المستحقة",
    signIn: (e: string) => `تدخل بـ ${e} برمز يُستخدم مرة وحدة.`,
    save: "احفظ", saving: "نحفظ…", saved: "تم الحفظ.",
    data: "بياناتك", dataSub: "نزّل كل اللي عندنا عنك: ملفك وعملاؤك وملاحظاتك وطلباتك ورصيدك، في ملف.", download: "نزّل بياناتي",
    danger: "حذف الحساب", dangerSub: "يحذف حسابك وعملاءك وملاحظاتك وطلباتك ورصيدك نهائيًا. سجلات الدفع نحتفظ فيها كما يلزم النظام. ما يمكن التراجع.",
    confirmLabel: (e: string) => `اكتب ${e} للتأكيد`, deleteGo: "احذف حسابي", deleting: "نحذف…", mismatch: "هذا مو بريدك، ما حذفنا شيء.",
    legal: "سياسة الخصوصية", terms: "الشروط",
  },
};

const input = "h-11 w-full rounded-[12px] bg-surface-2 px-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:outline-2 focus:outline-brand";
const lbl = "flex flex-col gap-1.5 text-[13px] font-medium text-subtle";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ lang?: string; saved?: string; confirm?: string }> }) {
  const { lang: l, saved, confirm } = await searchParams;
  const account = await pageAccount("/settings");
  const lang = pickLang(l, undefined, account.locale ?? "ar");
  const t = C[lang];
  const credits = await repo.creditBalance(account.id);
  return (
    <AppShell account={account} lang={lang} on="settings" credits={credits}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <PageHeader title={t.title} sub={t.sub} />
        {saved && <p role="status" className="rounded-[12px] bg-success-soft px-4 py-3 text-[14px] text-success-ink">{t.saved}</p>}

        <Card className="p-5 sm:p-6">
          <form action={updateSettingsAction} className="flex flex-col gap-6">
            <section className="flex flex-col gap-4">
              <div><h2 className="text-[16px] font-semibold text-ink">{t.profile}</h2><p className="text-[13px] text-subtle">{t.profileSub}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={lbl}>{t.name}<input name="displayName" required defaultValue={account.displayName} dir="auto" className={input} /></label>
                <label className={lbl}>{t.jobTitle}<input name="jobTitle" defaultValue={account.jobTitle ?? ""} dir="auto" className={input} /></label>
                <label className={lbl}>{t.company}<input name="company" defaultValue={account.company ?? ""} dir="auto" className={input} /></label>
                <label className={lbl}>{t.website}<input name="companyWebsite" defaultValue={account.companyWebsite ?? ""} dir="ltr" className={input} /></label>
                <label className={`${lbl} sm:col-span-2`}>{t.linkedin}<input name="linkedinUrl" defaultValue={account.linkedinUrl ?? ""} dir="ltr" className={input} /></label>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-[13px] font-medium text-subtle">{t.language}</legend>
                <div className="flex gap-2">
                  {(["ar", "en"] as const).map((x) => (
                    <label key={x} className="flex cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-[14px] text-ink has-[:checked]:bg-brand has-[:checked]:text-white">
                      <input type="radio" name="locale" value={x} defaultChecked={account.locale === x} className="sr-only" />{t[x]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
            <section className="flex flex-col gap-3 border-t border-line pt-5">
              <h2 className="text-[16px] font-semibold text-ink">{t.emails}</h2>
              {([["notifyResults", t.results, account.notifyResults], ["notifyReminders", t.reminders, account.notifyReminders]] as const).map(([name, text, on]) => (
                <label key={name} className="flex cursor-pointer items-center gap-3 text-[14.5px] text-ink">
                  <input type="checkbox" name={name} defaultChecked={on ?? true} data-testid={name} className="size-4 accent-[var(--color-brand,#1D3D33)]" />{text}
                </label>
              ))}
              <p className="text-[12.5px] text-subtle" dir="auto">{t.signIn(account.email)}</p>
            </section>
            <div className="flex justify-end border-t border-line pt-4"><SubmitButton pending={t.saving} icon="check" testId="save-settings">{t.save}</SubmitButton></div>
          </form>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex max-w-[460px] flex-col gap-1"><h2 className="text-[16px] font-semibold text-ink">{t.data}</h2><p className="text-[13.5px] text-muted">{t.dataSub}</p></div>
          <a href="/api/me/export" data-testid="export-data" className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-surface"><Icon name="file-text" size={14} />{t.download}</a>
        </Card>

        <Card className="p-5 outline-accent-soft sm:p-6">
          <form id="delete" action={deleteAccountAction} className="flex flex-col gap-3">
            <input type="hidden" name="lang" value={lang} />
            <h2 className="text-[16px] font-semibold text-accent-ink">{t.danger}</h2>
            <p className="text-[13.5px] text-muted">{t.dangerSub}</p>
            {confirm && <Tip icon="ban" tone="peach">{t.mismatch}</Tip>}
            <label className={lbl}>{t.confirmLabel(account.email)}<input name="confirm" autoComplete="off" dir="ltr" data-testid="delete-confirm" className={input} /></label>
            <div className="flex justify-end"><SubmitButton pending={t.deleting} icon="ban" testId="delete-account">{t.deleteGo}</SubmitButton></div>
          </form>
        </Card>

        <p className="text-center text-[12.5px] text-subtle">
          <a href={`/privacy?lang=${lang}`} className="hover:text-ink">{t.legal}</a> · <a href={`/terms?lang=${lang}`} className="hover:text-ink">{t.terms}</a>
        </p>
      </div>
    </AppShell>
  );
}
