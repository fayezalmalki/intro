import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { accounts, requests } from "./db/schema";
import type { Account, Role } from "./types";

/**
 * Bootstraps the first administrator, who can then grant roles from /am/team.
 *
 * Read once, at provisioning. Adding an address here later does not promote an
 * account that already exists — see accountForUser.
 */
export function adminEmails(): string[] {
  const raw = (env as unknown as { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}

export class NotAuthenticated extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "NotAuthenticated";
  }
}

export class NotPermitted extends Error {
  constructor(action: string) {
    super(`This account is not permitted to ${action}.`);
    this.name = "NotPermitted";
  }
}

function normalize(row: typeof accounts.$inferSelect): Account {
  return {
    ...row,
    verifiedAt: row.verifiedAt ?? undefined,
    frozenAt: row.frozenAt ?? undefined,
    frozenReason: row.frozenReason ?? undefined,
    assignedAm: row.assignedAm ?? undefined,
    company: row.company ?? undefined,
    companyWebsite: row.companyWebsite ?? undefined,
    jobTitle: row.jobTitle ?? undefined,
    useCase: row.useCase ?? undefined,
    linkedinUrl: row.linkedinUrl ?? undefined,
    onboardedAt: row.onboardedAt ?? undefined,
    activationRequestedAt: row.activationRequestedAt ?? undefined,
    activationNote: row.activationNote ?? undefined,
  };
}

/**
 * Resolves the account for a signed-in user, creating it on first sign-in.
 *
 * Provisioning is racy by nature: a first visit can fire several requests at
 * once and each would try to insert. `accounts_user_id_idx` makes only one
 * succeed, and the loser re-reads rather than surfacing a constraint error.
 */
export async function accountForUser(
  userId: string,
  email: string,
  database: Database = defaultDb,
): Promise<Account> {
  const [existing] = await database
    .select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (existing) return normalize(existing);

  const role: Role = isAdminEmail(email) ? "admin" : "requester";
  const name = email.split("@")[0];

  const [created] = await database
    .insert(accounts)
    .values({
      userId,
      role,
      displayName: name,
      initial: (name[0] ?? "?").toUpperCase(),
      email,
      state: "observer",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return normalize(created);

  // Another request won the insert.
  const [raced] = await database
    .select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (!raced) throw new Error(`Failed to provision an account for ${email}`);
  return normalize(raced);
}

/**
 * The signed-in account. Throws rather than redirecting, so a server action
 * reached directly fails closed instead of returning a redirect a caller can
 * ignore; middleware.ts handles the redirect for people browsing. The session
 * is validated against the database by Better Auth on every call.
 */
export async function currentAccount(database: Database = defaultDb): Promise<Account> {
  const { headers } = await import("next/headers");
  const { getSessionUser } = await import("./auth");
  const user = await getSessionUser(await headers());
  if (!user?.email) throw new NotAuthenticated();
  return accountForUser(user.id, user.email, database);
}

/**
 * The signed-in account for an app page, sent to /welcome first if they have
 * not finished onboarding. Pages only — a server action must not redirect a
 * caller somewhere it never asked to go; actions keep currentAccount().
 */
export async function pageAccount(next: string, database: Database = defaultDb): Promise<Account> {
  const account = await currentAccount(database);
  if (!account.onboardedAt) {
    const { redirect } = await import("next/navigation");
    redirect(`/welcome?next=${encodeURIComponent(next)}`);
  }
  return account;
}

/** The signed-in account, or null for a visitor. For pages that render either way. */
export async function maybeAccount(database: Database = defaultDb): Promise<Account | null> {
  try {
    return await currentAccount(database);
  } catch (error) {
    if (error instanceof NotAuthenticated) return null;
    throw error;
  }
}

export function isAccountManager(account: Account): boolean {
  return account.role === "account_manager" || account.role === "admin";
}

/**
 * Who may read a request.
 *
 * `currentAccount()` proves someone is signed in and nothing more. Until this
 * existed, /requests/[id] loaded a request by id and rendered it to anyone with
 * the URL — another person's brief, the full pipeline of names, titles and
 * companies, and a send button spending the *viewer's* credits.
 *
 * Account managers stay allowed on purpose: they can already read the same
 * request at /am/requests/[id], so refusing them here would protect nothing and
 * would break their own path through the app.
 */
export function canReadRequest(account: Account, requestAccountId: string): boolean {
  return account.id === requestAccountId || isAccountManager(account);
}

/**
 * The account that owns a request, for the actions that write against it.
 *
 * Stricter than canReadRequest, and deliberately not role-based: confirmBrief
 * rewrites the requester's own summary, and markOutreach spends the caller's
 * credits against the request it names. An account manager acting through
 * either would produce ledger rows for one account attached to another
 * account's request — incoherent whatever the role.
 *
 * A missing request is refused the same way as one owned by someone else, so
 * the error does not report which request ids exist.
 */
export async function requireRequestOwner(
  requestId: string,
  action: string,
  database: Database = defaultDb,
): Promise<Account> {
  const account = await currentAccount(database);
  const [request] = await database
    .select({ accountId: requests.accountId })
    .from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!request || request.accountId !== account.id) throw new NotPermitted(action);
  return account;
}

/**
 * The authorization boundary for account-manager work.
 *
 * Called inside each AM server action, not just on the pages: a server action
 * is a POST endpoint anyone can invoke without loading a page, so a route
 * guard alone would look like authorization and enforce nothing.
 */
export async function requireAccountManager(
  action: string,
  database: Database = defaultDb,
): Promise<Account> {
  const account = await currentAccount(database);
  if (!isAccountManager(account)) throw new NotPermitted(action);
  return account;
}

/**
 * The authorization boundary for changing someone's role.
 *
 * Deliberately admin-only rather than account-manager-only: an account manager
 * who could grant the role could promote themselves, which would make the
 * distinction between the two decorative.
 */
export async function requireAdmin(
  action: string,
  database: Database = defaultDb,
): Promise<Account> {
  const account = await currentAccount(database);
  if (account.role !== "admin") throw new NotPermitted(action);
  return account;
}

/**
 * The page-level counterpart to requireAccountManager / requireAdmin.
 *
 * Those throw, which is right for a server action: an action reached directly
 * must fail closed, and a caller ignoring a returned value would be a hole.
 * On a page the same throw reaches the error boundary and renders "صار خطأ غير
 * متوقع" under a 500 — telling someone the app broke when in fact they simply
 * are not allowed in. This returns null instead so the page can say so.
 *
 * Not a weaker check: the actions still hold the boundary, and this runs the
 * same policy.
 */
export async function accountForPage(
  need: "account_manager" | "admin",
  database: Database = defaultDb,
): Promise<Account | null> {
  const account = await pageAccount(need === "admin" ? "/am/team" : "/am", database);
  const permitted = need === "admin" ? account.role === "admin" : isAccountManager(account);
  return permitted ? account : null;
}
