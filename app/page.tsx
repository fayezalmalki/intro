import type { Metadata } from "next";
import { headers } from "next/headers";
import { Pitch } from "@/components/site/Pitch";
import { getSessionUser } from "@/lib/auth";
import { pitchEn as t } from "@/lib/site/pitch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: t.meta.title, description: t.meta.description };

/** The English site. Content: lib/site/pitch.ts; Arabic at /ar. */
export default async function Page() {
  const signedIn = Boolean(await getSessionUser(await headers()));
  return <Pitch t={t} signedIn={signedIn} />;
}
