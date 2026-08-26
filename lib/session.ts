import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { db as defaultDb } from "./db";
import { accounts, authUsers } from "./db/schema";
import type { Account, Role } from "./types";

/**
 * Bootstraps the first administrator, who can then grant roles from /am/team.
 *
 * Read once, at provisioning. Adding an address here later does not promote an
 * account that already exists — see accountForUser.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email) && ADMIN_EMAILS.includes(email!.toLowerCase());
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
 * ignore; middleware.ts handles the redirect for people browsing.
 */
export async function currentAccount(database: Database = defaultDb): Promise<Account> {
  const { auth } = await import("./auth");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new NotAuthenticated();

  const [user] = await database
    .select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
  if (!user) throw new NotAuthenticated();

  return accountForUser(user.id, email, database);
}

export function isAccountManager(account: Account): boolean {
  return account.role === "account_manager" || account.role === "admin";
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
  const account = await currentAccount(database);
  const permitted = need === "admin" ? account.role === "admin" : isAccountManager(account);
  return permitted ? account : null;
}
