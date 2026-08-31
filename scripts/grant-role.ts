/**
 * Promote an existing account to `account_manager` or `admin`.
 *
 * WHY THIS IS NEEDED
 * `ADMIN_EMAILS` is read exactly once, in `accountForUser()`, at the moment an
 * account row is first created:
 *
 *     const role: Role = isAdminEmail(email) ? "admin" : "requester";
 *
 * `accountForUser` returns early for an account that already exists, so the
 * variable is never consulted again. Adding an address to `ADMIN_EMAILS` after
 * that person has signed in once does nothing at all — they stay `requester`
 * and `/am` keeps refusing them.
 *
 * That is deliberate (a role is data, not config, and config should not silently
 * re-privilege accounts on deploy), but it leaves a bootstrap deadlock: the only
 * in-app way to change a role is `grantRole`, which itself requires an admin. If
 * the first account was created before `ADMIN_EMAILS` was set, there is no admin
 * to grant anything, and no route out through the UI.
 *
 * This script is that route out. It is the only thing here that writes a role
 * without an existing admin, which is why it is a local script and not an
 * endpoint.
 *
 *   npx tsx scripts/grant-role.ts you@example.com admin
 *   npx tsx scripts/grant-role.ts teammate@example.com account_manager
 *   npx tsx scripts/grant-role.ts you@example.com requester   # demote
 */
import { config } from "dotenv";

// Next loads .env.local automatically; a bare tsx script does not.
config({ path: ".env.local" });
config();

import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { accounts } from "../lib/db/schema";
import type { Role } from "../lib/types";

const ROLES: Role[] = ["requester", "account_manager", "admin"];

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role) {
    console.error("usage: npx tsx scripts/grant-role.ts <email> <role>");
    console.error(`       role is one of: ${ROLES.join(" | ")}`);
    process.exit(1);
  }
  if (!ROLES.includes(role as Role)) {
    console.error(`unknown role "${role}" — expected one of: ${ROLES.join(" | ")}`);
    process.exit(1);
  }

  const target = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: accounts.id, email: accounts.email, role: accounts.role })
    .from(accounts)
    .where(eq(accounts.email, target))
    .limit(1);

  if (!existing) {
    // Creating the row here would invent an account with no auth user behind
    // it. Signing in once is what provisions it correctly.
    console.error(
      `no account for ${target}. Sign in once at /login first — the account ` +
        `is created on first sign-in — then run this again.`,
    );
    process.exit(1);
  }

  if (existing.role === role) {
    console.log(`${target} is already ${role}. Nothing to do.`);
    return;
  }

  await db.update(accounts).set({ role: role as Role }).where(eq(accounts.id, existing.id));
  console.log(`${target}: ${existing.role} → ${role}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
