"use client";

import { useFormStatus } from "react-dom";
import { payWithTestProvider } from "@/lib/payments/test-actions";

/**
 * The stand-in's one button. A client component only so it can say "جارٍ…"
 * while the round trip through the real webhook path completes.
 */
export function TestPayButton({
  providerRef,
  returnUrl,
}: {
  providerRef: string;
  returnUrl: string;
}) {
  return (
    <form action={payWithTestProvider}>
      <input type="hidden" name="providerRef" value={providerRef} />
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "جارٍ إرسال الإشعار…" : "أرسل إشعار دفع موقّع (تجريبي)"}
    </button>
  );
}
