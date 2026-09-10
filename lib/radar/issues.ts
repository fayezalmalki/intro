import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { radarIssues, radarSignals } from "../db/schema";
import { logUsage } from "../usage";
import type { ClusterSlug } from "./clusters";

/**
 * An issue is a cluster's briefing for a period, and it is immutable once
 * published — the same rule pipelines follow in docs/01-mvp-plan.md §3. A
 * briefing that can be edited after the fact is not a record of what was said,
 * and this one names real executives.
 */

export interface IssueWithItems {
  issue: typeof radarIssues.$inferSelect;
  items: (typeof radarSignals.$inferSelect)[];
}

/** The next number for a cluster. Numbers are per cluster, starting at 1. */
async function nextNumber(db: Database, clusterSlug: ClusterSlug): Promise<number> {
  const [latest] = await db.select().from(radarIssues)
    .where(eq(radarIssues.clusterSlug, clusterSlug))
    .orderBy(desc(radarIssues.number)).limit(1);
  return (latest?.number ?? 0) + 1;
}

/** Opens a draft, or returns the one already open for this cluster. */
export async function openDraft(db: Database, clusterSlug: ClusterSlug) {
  const [existing] = await db.select().from(radarIssues)
    .where(and(eq(radarIssues.clusterSlug, clusterSlug), eq(radarIssues.status, "draft")));
  if (existing) return existing;
  const [created] = await db.insert(radarIssues)
    .values({ clusterSlug, number: await nextNumber(db, clusterSlug) }).returning();
  return created;
}

/** The approved, unpublished changes waiting for a cluster's next issue. */
export async function pendingItems(db: Database, clusterSlug: ClusterSlug) {
  return db.select().from(radarSignals)
    .where(and(eq(radarSignals.clusterSlug, clusterSlug), eq(radarSignals.status, "approved")));
}

export class EmptyIssueError extends Error {
  constructor(clusterSlug: string) {
    super(`radar issue for ${clusterSlug} has no approved items`);
    this.name = "EmptyIssueError";
  }
}

/**
 * Publishes a cluster's approved changes as its next issue.
 *
 * Refuses an empty one. A briefing that goes out with nothing in it teaches
 * subscribers that the mail is not worth opening, and a quiet week is a fact
 * worth respecting rather than padding — the cure for an empty issue is not
 * sending one.
 */
export async function publishIssue(db: Database, clusterSlug: ClusterSlug) {
  const items = await pendingItems(db, clusterSlug);
  if (items.length === 0) throw new EmptyIssueError(clusterSlug);

  const draft = await openDraft(db, clusterSlug);
  const publishedAt = new Date().toISOString();

  await db.update(radarIssues)
    .set({ status: "published", publishedAt })
    .where(eq(radarIssues.id, draft.id));

  for (const item of items) {
    await db.update(radarSignals)
      .set({ status: "published", issueId: draft.id })
      .where(eq(radarSignals.id, item.id));
  }

  await logUsage({
    kind: "radar_issue_published",
    meta: { cluster: clusterSlug, number: draft.number, items: items.length },
  }, db);

  return { ...draft, status: "published" as const, publishedAt };
}

/** The newest published issue for a cluster, with its items. */
export async function latestIssue(
  db: Database, clusterSlug: ClusterSlug,
): Promise<IssueWithItems | null> {
  const [issue] = await db.select().from(radarIssues)
    .where(and(eq(radarIssues.clusterSlug, clusterSlug), eq(radarIssues.status, "published")))
    .orderBy(desc(radarIssues.number)).limit(1);
  if (!issue) return null;
  return { issue, items: await itemsOf(db, issue.id) };
}

export async function issueByNumber(
  db: Database, clusterSlug: ClusterSlug, number: number,
): Promise<IssueWithItems | null> {
  const [issue] = await db.select().from(radarIssues).where(and(
    eq(radarIssues.clusterSlug, clusterSlug),
    eq(radarIssues.number, number),
    eq(radarIssues.status, "published"),
  ));
  if (!issue) return null;
  return { issue, items: await itemsOf(db, issue.id) };
}

/** Every published issue for a cluster, newest first. Archive, not content. */
export async function publishedIssues(db: Database, clusterSlug: ClusterSlug) {
  return db.select().from(radarIssues)
    .where(and(eq(radarIssues.clusterSlug, clusterSlug), eq(radarIssues.status, "published")))
    .orderBy(desc(radarIssues.number));
}

function itemsOf(db: Database, issueId: string) {
  return db.select().from(radarSignals).where(eq(radarSignals.issueId, issueId));
}
