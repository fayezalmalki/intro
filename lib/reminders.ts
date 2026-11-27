import * as repo from "./db/repo";
import { sendFollowUpDigest } from "./mailer";

/**
 * The daily follow-up reminder (worker/index.ts `scheduled`). One email per
 * account listing what's due; each lead is reminded once per follow-up.
 */
export async function sendDueReminders(now = new Date()): Promise<{ accounts: number; leads: number }> {
  const [followUps, nextSteps] = await Promise.all([repo.followUpReminders(now), repo.nextStepReminders(now)]);
  // One email per account: sequence follow-ups and the person's own next steps together.
  const due = new Map<string, { account: (typeof followUps)[number]["account"]; leads: { id: string; name: string; company: string; step: number | string }[]; seq: string[]; steps: string[] }>();
  for (const f of followUps) due.set(f.account.id, { account: f.account, leads: [...f.leads], seq: f.leads.map((l) => l.id), steps: [] });
  for (const n of nextSteps) {
    const e = due.get(n.account.id) ?? { account: n.account, leads: [], seq: [], steps: [] };
    e.leads.push(...n.items); e.steps.push(...n.items.map((i) => i.id)); due.set(n.account.id, e);
  }
  let leads = 0;
  for (const { account, leads: items, seq, steps } of due.values()) {
    try {
      await sendFollowUpDigest(account.email, account.displayName.split(/\s+/)[0] ?? account.displayName, account.locale === "en" ? "en" : "ar", items);
      await repo.markReminded(seq, now);
      await repo.markNextStepReminded(steps, now);
      leads += items.length;
    } catch (error) {
      console.error("[reminders] failed for an account", error);
    }
  }
  return { accounts: due.size, leads };
}
