"use client";

import { useActionState, useState } from "react";
import { revealCompanies, revealPeople, type SpendResult } from "@/lib/gtm/actions";

/**
 * The only control in the product that spends vendor credits.
 *
 * Two presses, not one. The first reveals the amount and what it buys; the
 * second submits it, with the amount travelling in the form so the server can
 * check that the price the user agreed to is the price the selection actually
 * costs. `confirmSpend` refuses on a mismatch — a row kept in another tab
 * between render and submit means the page they agreed to is not the page being
 * executed.
 *
 * There is no "don't ask again". Twenty credits a row against a balance of
 * about 1,730 is not a decision worth making frictionless.
 */
export function SpendButton({
  kind,
  runId,
  credits,
  rows,
}: {
  kind: "companies" | "people";
  runId: string;
  credits: number;
  rows: number;
}) {
  const [state, action, pending] = useActionState<SpendResult | undefined, FormData>(
    kind === "people" ? revealPeople : revealCompanies,
    undefined,
  );
  const [armed, setArmed] = useState(false);

  if (rows === 0) {
    return (
      <button type="button" className="btn btn-sm" disabled>
        ما فيه شيء نشتريه
      </button>
    );
  }

  if (!armed) {
    return (
      <div className="stack g8" style={{ alignItems: "flex-end" }}>
        <button type="button" className="btn btn-strong btn-sm" onClick={() => setArmed(true)}>
          اكشف — {credits} رصيد
        </button>
        {state && !state.ok && <span className="alert">{state.message}</span>}
      </div>
    );
  }

  return (
    <form action={action} className="stack g8" style={{ alignItems: "flex-end" }}>
      <input type="hidden" name="runId" value={runId} />
      {/* The number the user is looking at. The server recomputes the plan and
          refuses if this no longer matches it. */}
      <input type="hidden" name="confirmedCredits" value={credits} />
      <div className="note stack g6" style={{ maxWidth: 360 }}>
        <strong>
          تأكيد الشراء: {rows} صف × {kind === "people" ? 20 : 10} = {credits} رصيد
        </strong>
        <span>
          الرصيد ينخصم عند مزوّد البيانات مباشرة، وما يرجع. الصفوف اللي اشتريتها من قبل
          ما تنحسب مرة ثانية.
        </span>
      </div>
      <div className="row g8">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArmed(false)}>
          رجوع
        </button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {pending ? "جارٍ الشراء…" : `أكّد صرف ${credits} رصيد`}
        </button>
      </div>
      {state && !state.ok && <span className="alert">{state.message}</span>}
      {state?.ok && <span className="note">{state.message}</span>}
    </form>
  );
}
