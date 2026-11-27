import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Database } from "./db";
import { accounts, people, pipelineItems, pipelines, requests } from "./db/schema";
import { sendListReady } from "./mailer";

/** Emails the requester that their list is ready (or empty), honouring their preference. */
export async function notifyListReady(requestId: string, database: Database = defaultDb): Promise<boolean> {
  const [r] = await database.select({ request: requests, account: accounts }).from(requests)
    .innerJoin(accounts, eq(requests.accountId, accounts.id)).where(eq(requests.id, requestId)).limit(1);
  if (!r || !r.account.notifyResults) return false;
  const [latest] = await database.select({ id: pipelines.id }).from(pipelines)
    .where(eq(pipelines.requestId, requestId)).orderBy(sql`${pipelines.version} desc`).limit(1);
  const top = latest
    ? await database.select({ name: people.latin, title: people.title, company: people.company }).from(pipelineItems)
      .innerJoin(people, eq(pipelineItems.personId, people.id))
      .where(and(eq(pipelineItems.pipelineId, latest.id))).orderBy(pipelineItems.rank)
    : [];
  await sendListReady({
    to: r.account.email, name: r.account.displayName, locale: r.account.locale === "en" ? "en" : "ar",
    requestId, count: top.length, goal: ((r.request.brief as { summaryAr?: string } | null)?.summaryAr ?? r.request.rawText).slice(0, 140), top,
  });
  return true;
}
