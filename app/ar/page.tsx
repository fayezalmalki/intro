import type { Metadata } from "next";
import { headers } from "next/headers";
import { Landing } from "@/components/site/Landing";
import { getSessionUser } from "@/lib/auth";
import { ar } from "@/lib/site/ar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: ar.meta.title, description: ar.meta.description };

/** The Arabic site. Content: lib/site/ar.ts; English at /. */
export default async function Page() {
  const signedIn = Boolean(await getSessionUser(await headers()));
  return <Landing t={ar} signedIn={signedIn} />;
}
