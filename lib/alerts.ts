import * as repo from "./db/repo";
import { sendAdminAlert } from "./mailer";

/**
 * The admins' morning alert (worker/index.ts `scheduled`): sent only when
 * something needs a look — failed emails, search errors, people stuck at
 * sign-in, senders paused for bounces.
 */
export async function sendAdminAlerts(now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 86_400_000);
  const s = await repo.alertSummary(since);
  if (!s.emailFailures && !s.searchErrors && !s.stuckSignups && !s.outreachFailures && !s.paused.length) return false;
  const lines = [
    s.emailFailures && `${s.emailFailures} email(s) failed to send`,
    s.outreachFailures && `${s.outreachFailures} outreach message(s) failed to deliver`,
    s.paused.length && `${s.paused.length} account(s) paused for bounces: ${s.paused.map((p) => p.email).join(", ")}`,
    s.searchErrors && `${s.searchErrors} search(es) errored at the data provider`,
    s.stuckSignups && `${s.stuckSignups} person(s) asked for a sign-in code and never got in`,
  ].filter(Boolean) as string[];
  const details = s.recentErrors.map((e) => `${e.kind} → ${e.to}: ${e.error ?? "?"}`);
  const to = await repo.adminAddresses();
  if (!to.length) return false;
  await sendAdminAlert(to, lines, details);
  return true;
}
