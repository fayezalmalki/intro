import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, pickLang, withLang } from "@/components/site/AuthShell";
import { currentAccount } from "@/lib/session";
import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome · intro.sa" };

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
 * First-run onboarding (app/welcome/Onboarding.tsx): read their LinkedIn or
 * company site, three one-tap questions, then their first search runs. Every
 * app page redirects here until it is done; a search or request they started
 * before signing up (`next`) wins over the generated first search.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; lang?: string; missing?: string }>;
}) {
  const { next: rawNext, lang: langParam, missing } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/home?welcome=1";
  const account = await currentAccount();
  if (account.onboardedAt && !missing) redirect(next);

  const lang = pickLang(langParam, next, account.locale ?? "ar");
  const carried = fromNext(next, "company");
  const nameGuess = account.displayName === account.email.split("@")[0] ? "" : account.displayName;

  return (
    <AuthShell lang={lang} wide switchHref={withLang("/welcome", { next }, lang === "ar" ? "en" : "ar")}>
      <Onboarding lang={lang} next={next} defaults={{
        name: nameGuess,
        jobTitle: account.jobTitle ?? "",
        company: account.company ?? (looksLikeDomain(carried) ? "" : carried ?? ""),
        website: account.companyWebsite ?? (looksLikeDomain(carried) ? carried ?? "" : ""),
        linkedinUrl: account.linkedinUrl ?? "",
        useCase: account.useCase,
      }} />
    </AuthShell>
  );
}
