import type { Db, LedgerEntry, LedgerReason } from "./types";

/**
 * Balance is a projection over the append-only ledger — never a stored column.
 * A refund is a new row, so the history stays auditable and reconcilable.
 */
export function balanceOf(db: Db, accountId: string): number {
  return db.ledger
    .filter((e) => e.accountId === accountId)
    .reduce((sum, e) => sum + e.delta, 0);
}

/** How much of today's cap the account has already spent, in UTC days. */
export function sentToday(db: Db, accountId: string, now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  return db.sendAttempts.filter(
    (a) => a.accountId === accountId && a.result === "allowed" && a.at.slice(0, 10) === day,
  ).length;
}

const DELTA: Record<LedgerReason, number> = {
  purchase: 1,
  grant: 1,
  send: -1,
  refund_bounce: 1,
  refund_suppressed: 1,
  bonus_accept: 1,
};

/**
 * Per-send metering, parameterized so the meter does not reward volume:
 * a send costs one credit, a bounce or suppression hit refunds it, and an
 * accepted intro returns one. Bundles buy convenience, never a lower unit rate.
 */
export function entry(
  accountId: string,
  reason: LedgerReason,
  ref: string | undefined,
  id: string,
  amount = 1,
): LedgerEntry {
  return {
    id,
    accountId,
    delta: DELTA[reason] * amount,
    reason,
    ref,
    at: new Date().toISOString(),
  };
}
