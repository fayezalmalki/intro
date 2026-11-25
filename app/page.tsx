import type { Metadata } from "next";
import { headers } from "next/headers";
import { Landing } from "@/components/site/Landing";
import { getSessionUser } from "@/lib/auth";
import { en } from "@/lib/site/en";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: en.meta.title, description: en.meta.description };

/** The English site. Content: lib/site/en.ts; Arabic at /ar. */
export default async function Page() {
  const signedIn = Boolean(await getSessionUser(await headers()));
  return <Landing t={en} signedIn={signedIn} />;
}
