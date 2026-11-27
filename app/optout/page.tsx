import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { readOptOutToken } from "@/lib/optout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opt out · intro.sa", robots: { index: false } };

/** Where the opt-out link in outreach lands. Confirms first, so a link preview can't opt someone out. */
export default async function OptOutPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t = "", done } = await searchParams;
  const email = readOptOutToken(t, (env as unknown as { BETTER_AUTH_SECRET?: string }).BETTER_AUTH_SECRET ?? "");
  const box = { maxWidth: 480, margin: "80px auto", padding: 28, background: "#fff", border: "1px solid #E5E6E0", borderRadius: 16, fontFamily: "-apple-system,'Segoe UI','IBM Plex Sans Arabic',Tahoma,sans-serif", color: "#141613", lineHeight: 1.7 } as const;
  const btn = { background: "#1D3D33", color: "#fff", border: 0, borderRadius: 999, padding: "12px 22px", fontSize: 15, cursor: "pointer" } as const;
  return (
    <main style={{ background: "#F4F4F1", minHeight: "100vh", padding: "1px 16px" }}>
      <div style={box}>
        {!email ? (
          <p>هذا الرابط غير صالح. · This link isn't valid.</p>
        ) : done ? (
          <>
            <h1 style={{ fontSize: 20 }}>تم. ما بتوصلك رسائل عبر انترو.</h1>
            <p dir="ltr">Done — you won&apos;t receive messages sent through intro.sa at <b>{email}</b>.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20 }}>إيقاف الرسائل عبر انترو</h1>
            <p>ما تبي توصلك رسائل يرسلها مستخدمو انترو إلى <b dir="ltr">{email}</b>؟</p>
            <p dir="ltr" style={{ color: "#575B54" }}>Stop messages that intro.sa users send to <b>{email}</b>?</p>
            <form method="post" action="/api/optout">
              <input type="hidden" name="t" value={t} />
              <input type="hidden" name="from" value="page" />
              <button type="submit" style={btn}>أوقفها · Stop them</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
