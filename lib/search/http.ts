import "server-only";
import { getSessionUser } from "../auth";
import { accountForUser } from "../session";
import type { Account } from "../types";
import { SearchError } from "./service";

/** The signed-in account for an API call, or a 401 to return. */
export async function apiAccount(request: Request): Promise<Account | Response> {
  const user = await getSessionUser(request.headers);
  if (!user?.email) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return accountForUser(user.id, user.email);
}

const STATUS: Record<SearchError["code"], number> = {
  unavailable: 503, budget: 429, bad_query: 400, upstream: 502, insufficient_credits: 402,
};

/** One error shape for the search UI: a code it can phrase in either language. */
export function apiError(error: unknown): Response {
  if (error instanceof SearchError) return Response.json({ error: error.code }, { status: STATUS[error.code] });
  console.error("[search] unexpected", error);
  return Response.json({ error: "upstream" }, { status: 500 });
}
