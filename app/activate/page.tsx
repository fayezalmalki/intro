import type { Metadata } from "next";
import { AuthShell, field, inputCls, labelCls, pickLang, primaryBtn, withLang } from "@/components/site/AuthShell";
import { Icon } from "@/components/site/ui";
import { requestActivation } from "@/lib/actions";
import { pageAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send through intro · intro.sa" };

const COPY = {
  en: {
    step: "Send through intro",
    title: "Send through intro",
    sub: "You can always send from your own email. To send through intro — from \"you via intro\", with replies to your inbox — we check who's sending first. It keeps intro a sender people trust.",
    why: [
      "Instant if you signed up with your work email at your company's domain",
      "Otherwise we confirm you work where you say — usually within one business day",
      "Then: verified recipients only, a daily limit, and an opt-out on every email",
    ],
    linkedin: "LinkedIn profile",
    website: "Company website",
    note: "Anything we should know?",
    optional: "optional",
    notePh: "e.g. who you're trying to reach, and roughly how many people a week",
    missing: "Add your LinkedIn profile and company website.",
    submit: "Verify me",
    later: "Not now — I'll use my own email",
    pendingTitle: "We're on it",
    pendingSub: (email: string) => <>We're checking your account and will email <b className="font-latin font-semibold text-ink">{email}</b> when you can send through intro — usually within one business day.</>,
    pendingMeanwhile: "Meanwhile, every lead still opens in your own email.",
    pendingCta: "Back to my leads",
    doneTitle: "You can send through intro",
    doneSub: (cap: number) => `Open any lead and press "Send through intro" — up to ${cap} a day, to verified addresses.`,
    doneCta: "Open my leads",
  },
  ar: {
    step: "الإرسال عبر انترو",
    title: "أرسل عبر انترو",
    sub: "تقدر دايم ترسل من بريدك. وعشان ترسل عبر انترو، باسمك «عبر انترو» والردود توصل بريدك، نتحقق من هوية المرسل أول. كذا يبقى انترو مرسل يثق فيه الناس.",
    why: [
      "فوري إذا سجّلت ببريد عملك على نطاق شركتك",
      "غير كذا نتأكد إنك تعمل في الجهة اللي ذكرتها، وعادةً خلال يوم عمل",
      "وبعدها: بريد موثّق فقط، وحد يومي، ورابط إلغاء اشتراك في كل رسالة",
    ],
    linkedin: "حسابك في LinkedIn",
    website: "موقع الشركة",
    note: "تبي تضيف شيئًا؟",
    optional: "اختياري",
    notePh: "مثال: مين تبي توصل له، وكم شخص تقريبًا في الأسبوع",
    missing: "أضف حسابك في LinkedIn وموقع شركتك.",
    submit: "وثّقني",
    later: "مو الحين، بستخدم بريدي",
    pendingTitle: "طلبك وصلنا",
    pendingSub: (email: string) => <>نراجع حسابك، ونراسلك على <b className="font-latin font-semibold text-ink" dir="ltr">{email}</b> أول ما تقدر ترسل عبر انترو، وعادةً خلال يوم عمل.</>,
    pendingMeanwhile: "وفي الوقت نفسه، كل عميل يفتح في بريدك عادي.",
    pendingCta: "ارجع لعملائي",
    doneTitle: "تقدر ترسل عبر انترو",
    doneSub: (cap: number) => `افتح أي عميل واضغط «أرسلها عبر انترو»، بحد ${cap} رسائل يوميًا للبريد الموثّق.`,
    doneCta: "افتح عملائي",
  },
};

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; lang?: string; missing?: string; sent?: string }>;
}) {
  const { next: rawNext, lang: langParam, missing, sent } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/requests";
  const account = await pageAccount("/activate");
  const lang = pickLang(langParam, undefined, account.locale ?? "ar");
  const t = COPY[lang];
  const shell = { lang, wide: true, switchHref: withLang("/activate", { next }, lang === "ar" ? "en" : "ar") } as const;

  if (account.state !== "observer") {
    return (
      <AuthShell {...shell}>
        <Status icon="check-circle" title={t.doneTitle} body={t.doneSub(account.dailyCap)} href={`/leads?lang=${lang}`} cta={t.doneCta} />
      </AuthShell>
    );
  }

  if (sent || account.activationRequestedAt) {
    return (
      <AuthShell {...shell} step={{ at: 2, of: 2, label: t.step }}>
        <Status icon="clock" title={t.pendingTitle} body={<>{t.pendingSub(account.email)}<br /><br />{t.pendingMeanwhile}</>} href={next} cta={t.pendingCta} />
      </AuthShell>
    );
  }

  return (
    <AuthShell {...shell} step={{ at: 2, of: 2, label: t.step }}>
      <form action={requestActivation} className="flex flex-col gap-6">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
          <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{t.sub}</p>
        </div>
        <ul className="flex flex-col gap-2 rounded-[14px] bg-mint px-4 py-3.5">
          {t.why.map((w) => (
            <li key={w} className="flex items-center gap-2.5 text-[14px] text-ink"><Icon name="check" size={15} className="text-brand" />{w}</li>
          ))}
        </ul>
        {missing && <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-accent-ink">{t.missing}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label className={labelCls} htmlFor="linkedinUrl">{t.linkedin}</label>
            <input id="linkedinUrl" name="linkedinUrl" required dir="ltr" inputMode="url" placeholder="linkedin.com/in/you" defaultValue={account.linkedinUrl} className={`${inputCls} font-latin rtl:text-right`} />
          </div>
          <div className={field}>
            <label className={labelCls} htmlFor="companyWebsite">{t.website}</label>
            <input id="companyWebsite" name="companyWebsite" required dir="ltr" inputMode="url" placeholder="yourcompany.sa" defaultValue={account.companyWebsite} className={`${inputCls} font-latin rtl:text-right`} />
          </div>
        </div>
        <div className={field}>
          <label className={labelCls} htmlFor="note">{t.note} <span className="font-normal text-subtle">· {t.optional}</span></label>
          <textarea id="note" name="note" rows={3} maxLength={500} placeholder={t.notePh} className={`${inputCls} h-auto py-3 leading-[22px]`} />
        </div>
        <div className="flex flex-col gap-3">
          <button type="submit" className={primaryBtn}>{t.submit}</button>
          <a href={next} className="text-center text-[14px] text-muted hover:text-ink">{t.later}</a>
        </div>
      </form>
    </AuthShell>
  );
}

function Status({ icon, title, body, href, cta }: { icon: "check-circle" | "clock"; title: string; body: React.ReactNode; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-5">
      <span className="flex size-12 items-center justify-center rounded-[14px] bg-mint text-brand"><Icon name={icon} size={22} /></span>
      <div className="flex flex-col gap-2">
        <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{title}</h1>
        <p className="text-[15px] leading-[24px] text-muted rtl:leading-[27px]">{body}</p>
      </div>
      <a href={href} className={primaryBtn}>{cta}</a>
    </div>
  );
}
