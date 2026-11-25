import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, field, inputCls, labelCls, pickLang, primaryBtn, withLang } from "@/components/site/AuthShell";
import { Icon, cx } from "@/components/site/ui";
import { completeOnboarding } from "@/lib/actions";
import { currentAccount } from "@/lib/session";
import { ar } from "@/lib/site/ar";
import { en } from "@/lib/site/en";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome · intro.sa" };

const COPY = {
  en: {
    step: "Step 1 of 2 · About you",
    title: "Let's set up your account",
    sub: "Two minutes. This is how we introduce you — so the people you reach know who's asking.",
    name: "Full name",
    company: "Company",
    website: "Company website",
    optional: "optional",
    role: "Your role",
    rolePh: "e.g. Head of Sales",
    goal: "What brings you to intro.sa?",
    linkedin: "LinkedIn profile",
    linkedinHint: "Speeds up activation. You can add it later.",
    missing: "Add your name, company and role to continue.",
    submit: "Continue",
  },
  ar: {
    step: "الخطوة ١ من ٢ · معلوماتك",
    title: "خلّنا نجهّز حسابك",
    sub: "دقيقتين بس. بهذي المعلومات نعرّف عنك، عشان اللي تتواصل معهم يعرفون مين يكلمهم.",
    name: "الاسم الكامل",
    company: "الشركة",
    website: "موقع الشركة",
    optional: "اختياري",
    role: "منصبك",
    rolePh: "مثال: مدير المبيعات",
    goal: "وش اللي جابك لـ intro.sa؟",
    linkedin: "حسابك في LinkedIn",
    linkedinHint: "يسرّع تفعيل حسابك، وتقدر تضيفه لاحقًا.",
    missing: "أضف اسمك وشركتك ومنصبك عشان تكمل.",
    submit: "متابعة",
  },
};

/** Pulls a value carried inside `next` (the landing's ?company= survives sign-in there). */
function fromNext(next: string, key: string): string | undefined {
  try {
    return new URL(next, "https://intro.sa").searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

const looksLikeDomain = (v?: string) => Boolean(v && /^[^\s/]+\.[a-z]{2,}(\/.*)?$/i.test(v.replace(/^https?:\/\//, "")));

/**
 * First-run onboarding. Every app page redirects here (lib/session.ts
 * pageAccount) until it is done; `next` returns them where they were headed.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; lang?: string; missing?: string }>;
}) {
  const { next: rawNext, lang: langParam, missing } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/new";
  const account = await currentAccount();
  if (account.onboardedAt && !missing) redirect(next);

  const lang = pickLang(langParam, next, account.locale ?? "ar");
  const t = COPY[lang];
  const cases = (lang === "en" ? en : ar).useCases.items;
  const carried = fromNext(next, "company");
  const nameGuess = account.displayName === account.email.split("@")[0] ? "" : account.displayName;

  return (
    <AuthShell lang={lang} wide switchHref={withLang("/welcome", { next }, lang === "ar" ? "en" : "ar")} step={{ at: 1, of: 2, label: t.step }}>
      <form action={completeOnboarding} className="flex flex-col gap-6">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={lang} />
        <div className="flex flex-col gap-2">
          <h1 className="display font-display text-[28px] leading-[1.1] font-medium tracking-[-1px] text-ink">{t.title}</h1>
          <p className="text-[15px] leading-[23px] text-muted rtl:leading-[26px]">{t.sub}</p>
        </div>

        {missing && <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-accent-ink">{t.missing}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label className={labelCls} htmlFor="name">{t.name}</label>
            <input id="name" name="name" required autoComplete="name" defaultValue={nameGuess} className={inputCls} />
          </div>
          <div className={field}>
            <label className={labelCls} htmlFor="jobTitle">{t.role}</label>
            <input id="jobTitle" name="jobTitle" required autoComplete="organization-title" placeholder={t.rolePh} defaultValue={account.jobTitle} className={inputCls} />
          </div>
          <div className={field}>
            <label className={labelCls} htmlFor="company">{t.company}</label>
            <input id="company" name="company" required autoComplete="organization" defaultValue={account.company ?? (looksLikeDomain(carried) ? "" : carried)} className={inputCls} />
          </div>
          <div className={field}>
            <label className={labelCls} htmlFor="companyWebsite">{t.website} <span className="font-normal text-subtle">· {t.optional}</span></label>
            <input id="companyWebsite" name="companyWebsite" dir="ltr" inputMode="url" placeholder="yourcompany.sa" defaultValue={account.companyWebsite ?? (looksLikeDomain(carried) ? carried : "")} className={`${inputCls} font-latin rtl:text-right`} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className={cx(labelCls, "mb-2.5")}>{t.goal}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {cases.map((u, i) => (
              <label key={u.id} className="group flex cursor-pointer items-start gap-3 rounded-[14px] p-3 outline outline-1 -outline-offset-1 outline-line transition-colors hover:bg-surface-3 has-[:checked]:bg-mint has-[:checked]:outline-2 has-[:checked]:outline-brand">
                <input type="radio" name="useCase" value={u.id} defaultChecked={account.useCase ? account.useCase === u.id : i === 0} className="sr-only" />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-brand group-has-[:checked]:bg-white">
                  <Icon name={u.icon} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold text-ink">{u.name}</span>
                  <span className="text-[12.5px] leading-[17px] text-muted rtl:leading-5">{u.example}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={field}>
          <label className={labelCls} htmlFor="linkedinUrl">{t.linkedin} <span className="font-normal text-subtle">· {t.optional}</span></label>
          <input id="linkedinUrl" name="linkedinUrl" dir="ltr" inputMode="url" placeholder="linkedin.com/in/you" defaultValue={account.linkedinUrl} className={`${inputCls} font-latin rtl:text-right`} />
          <span className="text-[12.5px] text-subtle">{t.linkedinHint}</span>
        </div>

        <button type="submit" className={primaryBtn}>
          {t.submit}
          <Icon name="arrow-right" size={15} flip />
        </button>
      </form>
    </AuthShell>
  );
}
