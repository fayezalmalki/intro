"use server";

import { db } from "../db";
import { broadcastPlan } from "./broadcast";
import { subscribe } from "./subscribers";

/**
 * The public subscribe action. No auth — that is the point of a briefing.
 *
 * The confirmation mail is Radar mail, so it is subject to the same gate as
 * the broadcast: until Radar has its own sending subdomain, nothing leaves.
 * The request is still recorded as `pending`, and the page says plainly that
 * no mail was sent rather than showing "check your inbox" for a message that
 * does not exist. Being honest about what the product does today is cheaper
 * than an inbox nobody can find anything in.
 */

export type SubscribeResult =
  | { ok: true; state: "confirm_sent" }
  | { ok: true; state: "recorded_no_mail"; reason: string }
  | { ok: true; state: "already_confirmed" }
  | { ok: false; error: "invalid_email" };

/** Deliberately permissive: rejecting valid odd addresses is worse than a bounce. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function requestSubscription(
  formData: FormData,
): Promise<SubscribeResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!looksLikeEmail(email)) return { ok: false, error: "invalid_email" };

  const clusters = formData.getAll("cluster").map(String);
  const lang = String(formData.get("lang") ?? "ar") === "en" ? "en" : "ar";

  const outcome = await subscribe(db, email, clusters, lang);
  if (outcome.status === "already_confirmed") return { ok: true, state: "already_confirmed" };

  const plan = broadcastPlan();
  if (!plan.enabled) return { ok: true, state: "recorded_no_mail", reason: plan.reason };

  // When the sender exists, the confirmation is the only mail an unconfirmed
  // address ever receives.
  return { ok: true, state: "confirm_sent" };
}
