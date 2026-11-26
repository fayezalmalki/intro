"use client";

import { useActionState } from "react";
import { markOutreach, type SendResult } from "@/lib/actions";
import { Icon } from "@/components/site/ui";

/**
 * The send control. A refusal from the gate is shown in place rather than
 * thrown away, so the requester learns *why* — suppressed, on cooldown, over
 * cap, or too close to a message they already sent.
 */
export function SendButton({
  requestId, personId, channel, body, label, pendingLabel,
}: {
  requestId: string; personId: string; channel: string; body: string; label: string; pendingLabel: string;
}) {
  const [state, action, pending] = useActionState<SendResult | undefined, FormData>(markOutreach, undefined);
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="channel" value={channel} />
        <input type="hidden" name="body" value={body} />
        <button type="submit" disabled={pending} data-testid="send"
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-brand px-4 text-[13.5px] font-medium text-white hover:bg-brand-2 disabled:cursor-wait disabled:opacity-70">
          {pending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="send" size={13} flip />}
          {pending ? pendingLabel : label}
        </button>
      </form>
      {state && !state.ok && state.reason && (
        <p role="alert" data-testid="gate-error" className="max-w-[380px] rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">{state.reason}</p>
      )}
    </div>
  );
}
