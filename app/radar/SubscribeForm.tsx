"use client";

import { useState } from "react";
import { requestSubscription, type SubscribeResult } from "@/lib/radar/public-actions";
import { CLUSTERS } from "@/lib/radar/clusters";
import type { Lang } from "./RadarChrome";

/**
 * The one interactive element on the briefing.
 *
 * A client component because the result has four distinct outcomes and one of
 * them — "recorded, but no mail was sent, and here is why" — has to be read
 * rather than inferred from a redirect. Saying "check your inbox" for a message
 * that does not exist is the failure this is shaped to avoid.
 */
export function SubscribeForm({ lang, cluster }: { lang: Lang; cluster?: string }) {
  const [result, setResult] = useState<SubscribeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const ar = lang === "ar";

  return (
    <form
      className="stack g12"
      action={async (formData: FormData) => {
        setBusy(true);
        try { setResult(await requestSubscription(formData)); } finally { setBusy(false); }
      }}
    >
      <input type="hidden" name="lang" value={lang} />
      {cluster
        ? <input type="hidden" name="cluster" value={cluster} />
        : (
          <div className="row g8 wrapx">
            {CLUSTERS.map((c) => (
              <label className="chip" key={c.slug}>
                <input type="checkbox" name="cluster" value={c.slug} />{" "}
                {ar ? c.ar : c.en}
              </label>
            ))}
          </div>
        )}
      <div className="hero-form">
        <input
          type="email" name="email" required
          aria-label={ar ? "بريدك المهني" : "Your work email"}
          placeholder={ar ? "بريدك المهني" : "Your work email"}
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? (ar ? "…" : "…") : ar ? "اشترك" : "Subscribe"}
        </button>
      </div>

      {result && !result.ok && (
        <span className="sm" style={{ color: "var(--danger)" }}>
          {ar ? "تحقق من صيغة البريد." : "That email doesn't look right."}
        </span>
      )}
      {result?.ok && result.state === "confirm_sent" && (
        <span className="sm muted">
          {ar
            ? "أرسلنا رسالة تأكيد. الاشتراك لا يبدأ قبل الضغط على الرابط فيها."
            : "We sent a confirmation. Nothing starts until you click the link in it."}
        </span>
      )}
      {result?.ok && result.state === "already_confirmed" && (
        <span className="sm muted">
          {ar ? "هذا البريد مشترك بالفعل. حدّثنا اختيارك للقطاعات."
              : "That address is already subscribed. We updated your clusters."}
        </span>
      )}
      {/* The honest one. */}
      {result?.ok && result.state === "recorded_no_mail" && (
        <span className="sm muted">
          {ar
            ? "سجّلنا طلبك. البريد الدوري لم يبدأ بعد، وما أرسلنا لك رسالة تأكيد — سنراسلك أول ما يبدأ."
            : "We recorded your request. The briefing isn't sending yet and no confirmation was sent — we'll write when it starts."}
        </span>
      )}
    </form>
  );
}
