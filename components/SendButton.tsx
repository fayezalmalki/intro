"use client";

import { useActionState } from "react";
import { markOutreach, type SendResult } from "@/lib/actions";

/**
 * The send control. A refusal from the gate is shown in place rather than
 * thrown away, so the requester learns *why* — suppressed, on cooldown, over
 * cap, or too close to a message they already sent.
 */
export function SendButton({
  requestId,
  personId,
  channel,
  body,
  label,
}: {
  requestId: string;
  personId: string;
  channel: string;
  body: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<SendResult | undefined, FormData>(
    markOutreach,
    undefined,
  );

  return (
    <div className="stack g8" style={{ alignItems: "flex-end" }}>
      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="channel" value={channel} />
        <input type="hidden" name="body" value={body} />
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {pending ? "جارٍ الإرسال…" : label}
        </button>
      </form>
      {state && !state.ok && state.reason && (
        <div className="alert" style={{ maxWidth: 380 }}>
          {state.reason}
        </div>
      )}
    </div>
  );
}
