import type { Metadata } from "next";
import { Legal } from "@/components/site/Legal";
import { privacy } from "@/lib/site/legal";

export const metadata: Metadata = { title: "Privacy · intro.sa" };

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === "en" ? "en" : "ar";
  return <Legal doc={privacy[lang]} lang={lang} other={lang === "ar" ? { href: "/privacy?lang=en", label: "English" } : { href: "/privacy?lang=ar", label: "العربية" }} />;
}
