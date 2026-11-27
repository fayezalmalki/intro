import * as repo from "./db/repo";
import { sendFollowUpDigest } from "./mailer";

/**
 * The daily follow-up reminder (worker/index.ts `scheduled`). One email per
 * account listing what's due; each lead is reminded once per follow-up.
 */
export async function sendDueReminders(now = new Date()): Promise<{ accounts: number; leads: number }> {
  const due = await repo.followUpReminders(now);
  let leads = 0;
  for (const { account, leads: items } of due) {
    try {
      await sendFollowUpDigest(account.email, account.displayName.split(/\s+/)[0] ?? account.displayName, account.locale === "en" ? "en" : "ar", items);
      await repo.markReminded(items.map((l) => l.id), now);
      leads += items.length;
    } catch (error) {
      console.error("[reminders] failed for an account", error);
    }
  }
  return { accounts: due.length, leads };
}
