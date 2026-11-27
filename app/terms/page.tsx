import type { Metadata } from "next";
import { Legal } from "@/components/site/Legal";
import { terms } from "@/lib/site/legal";

export const metadata: Metadata = { title: "Terms · intro.sa" };

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === "en" ? "en" : "ar";
  return <Legal doc={terms[lang]} lang={lang} other={lang === "ar" ? { href: "/terms?lang=en", label: "English" } : { href: "/terms?lang=ar", label: "العربية" }} />;
}
