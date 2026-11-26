"use client";

import { useEffect } from "react";
import { StatusPage, statusBtn } from "@/components/app/StatusPage";

/**
 * Logs the real error rather than leaving only a digest, and offers a way on.
 * The digest stays visible: /api/health says whether setup is the cause.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error.digest ?? "", error.message, error.stack);
  }, [error]);
  return (
    <StatusPage
      icon="refresh"
      ar={{ title: "صار خطأ غير متوقع", body: "سجّلنا التفاصيل. جرّب مرة ثانية، وإذا تكرر تواصل معنا على hello@intro.sa." }}
      en={{ title: "Something went wrong", body: "We've logged it. Try again — if it keeps happening, write to hello@intro.sa." }}
    >
      <button type="button" onClick={reset} className={`${statusBtn} bg-brand text-white hover:bg-brand-2`}>حاول مرة ثانية · Try again</button>
      <a href="/home" className={`${statusBtn} bg-white text-ink outline outline-1 -outline-offset-1 outline-line`}>الرئيسية · Home</a>
      {error.digest && <p className="w-full pt-2 font-latin text-[12px] text-subtle" dir="ltr">ref {error.digest}</p>}
    </StatusPage>
  );
}
