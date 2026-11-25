import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser, googleEnabled } from "@/lib/auth";
import { AuthShell, pickLang, withLang } from "@/components/site/AuthShell";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in · intro.sa" };

/**
 * The only unauthenticated app screen. Middleware sends everyone here with
 * `?next=`, so a signed-in visitor who lands here has already arrived —
 * bounce them onward rather than showing a form they do not need.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; lang?: string }>;
}) {
  const { next, lang: langParam } = await searchParams;

  // Only same-site paths. An open redirect here would let a phishing link send
  // a freshly-signed-in user to an attacker's page carrying our domain's trust.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (await getSessionUser(await headers())) redirect(target);

  const lang = pickLang(langParam, next);
  return (
    <AuthShell lang={lang} switchHref={withLang("/login", { next }, lang === "ar" ? "en" : "ar")}>
      <LoginForm target={target} providers={{ google: googleEnabled() }} lang={lang} />
    </AuthShell>
  );
}
