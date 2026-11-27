"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, cx, type IconKey } from "@/components/site/ui";

/** A form's submit button that shows it's working, so a slow server step never looks stuck. */
export function SubmitButton({ children, pending, icon, className, testId, disabled }: { children: ReactNode; pending: ReactNode; icon?: IconKey; className?: string; testId?: string; disabled?: boolean }) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      data-testid={testId}
      className={cx("inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-white transition-colors hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : icon && <Icon name={icon} size={15} flip />}
      {busy ? pending : children}
    </button>
  );
}
