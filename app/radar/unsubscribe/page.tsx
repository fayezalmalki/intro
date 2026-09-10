import Link from "next/link";
import { db } from "@/lib/db";
import { unsubscribe } from "@/lib/radar/subscribers";
import { RadarShell, readLang } from "../RadarChrome";

export const dynamic = "force-dynamic";

/**
 * One click, no sign-in, no "tell us why", no confirmation step.
 *
 * Cancelling has to be as easy as subscribing. A hostile unsubscribe flow buys
 * a complaint instead of a departure, and a complaint costs the sending domain
 * — which, per docs/sending-domains.md, is the asset that cannot be rebuilt in
 * a sprint.
 */
export default async function UnsubscribePage({
  searchParams,
}: { searchParams: Promise<{ token?: string; lang?: string }> }) {
  const { token, lang: raw } = await searchParams;
  const lang = readLang(raw);
  const ar = lang === "ar";
  const done = token ? await unsubscribe(db, token) : false;

  return (
    <RadarShell lang={lang} here="/radar/unsubscribe">
      <div className="landing-wrap">
        <section className="hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="stack g20">
            <h1>
              {done
                ? ar ? "تم إلغاء الاشتراك." : "You're unsubscribed."
                : ar ? "الرابط غير صالح." : "That link isn't valid."}
            </h1>
            <p>
              {done
                ? ar
                  ? "ما راح يصلك شيء بعد الآن. ما نحتاج سببًا، وما راح نسأل."
                  : "Nothing further will reach you. We don't need a reason and won't ask."
                : ar
                  ? "قد يكون الرابط استُخدم من قبل. إن استمر وصول الرسائل، راسلنا."
                  : "It may already have been used. If mail keeps arriving, write to us."}
            </p>
            <Link className="sm" href={ar ? "/radar" : "/radar?lang=en"}>
              {ar ? "إلى الرادار" : "Back to Radar"}
            </Link>
          </div>
        </section>
      </div>
    </RadarShell>
  );
}
