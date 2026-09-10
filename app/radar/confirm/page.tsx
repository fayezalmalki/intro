import Link from "next/link";
import { db } from "@/lib/db";
import { confirm } from "@/lib/radar/subscribers";
import { RadarShell, readLang } from "../RadarChrome";

export const dynamic = "force-dynamic";

/**
 * The only route from `pending` to `confirmed`.
 *
 * An unknown or spent token gets the same neutral answer as a wrong one: this
 * page must not become a way to test whether an address is on the list.
 */
export default async function ConfirmPage({
  searchParams,
}: { searchParams: Promise<{ token?: string; lang?: string }> }) {
  const { token, lang: raw } = await searchParams;
  const lang = readLang(raw);
  const ar = lang === "ar";
  const ok = token ? await confirm(db, token) : false;

  return (
    <RadarShell lang={lang} here="/radar/confirm">
      <div className="landing-wrap">
        <section className="hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="stack g20">
            <h1>
              {ok
                ? ar ? "تم تأكيد اشتراكك." : "You're subscribed."
                : ar ? "الرابط غير صالح." : "That link isn't valid."}
            </h1>
            <p>
              {ok
                ? ar
                  ? "يصلك موجز كل قطاع اخترته فور صدوره. في أسفل كل رسالة رابط إلغاء بضغطة واحدة."
                  : "You'll get each cluster's brief as it ships. Every issue carries a one-click unsubscribe."
                : ar
                  ? "قد يكون الرابط استُخدم من قبل أو انتهت صلاحيته. اطلب رابطًا جديدًا من صفحة الرادار."
                  : "It may already have been used, or expired. Ask for a new one from the Radar page."}
            </p>
            <Link className="btn btn-primary btn-sm" href={ar ? "/radar" : "/radar?lang=en"}
              style={{ alignSelf: "flex-start" }}>
              {ar ? "إلى الرادار" : "Back to Radar"}
            </Link>
          </div>
        </section>
      </div>
    </RadarShell>
  );
}
