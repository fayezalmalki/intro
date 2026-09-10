/**
 * Sending an issue — and the reasons it does not send yet.
 *
 * Radar is bulk mail. `docs/sending-domains.md` states the rule plainly: pool 1
 * carries sign-in codes to our own users and "must never be borrowed for
 * anything else". A complaint on a briefing that rode intro.sa would degrade
 * the domain people log in through, and that failure is silent — users simply
 * stop receiving codes for a product that has nothing to do with the mail that
 * caused it.
 *
 * Radar is *not* pool 2 either, and the distinction is the whole reason this
 * can ship at all. Pool 2 is unsolicited: the recipient never asked, which is
 * what every mainstream ESP's AUP prohibits and why it needs SES and a written
 * production-access review. Radar goes only to an address that clicked a link
 * sent to it — solicited mail, permitted on the Resend account that already
 * exists, on its own subdomain so its reputation stays its own.
 *
 * That subdomain does not exist yet, and DNS is not something this repo can
 * create. So the broadcast is built, tested and switched off, and it refuses
 * with a reason rather than pretending to have sent — the same posture
 * `lib/mailer.ts` takes when SMTP is unconfigured in production.
 */

export type BroadcastRefusal =
  /** RADAR_BROADCAST_ENABLED is not set. The default, and deliberately so. */
  | "disabled"
  /** No dedicated sender configured, so the only route left would be pool 1. */
  | "no_radar_sender";

export interface BroadcastPlan {
  enabled: boolean;
  refusal: BroadcastRefusal | null;
  sender: string | null;
  /** Human-readable, and shown in the console rather than swallowed. */
  reason: string;
}

/**
 * The domain Radar is allowed to send from. A subdomain of intro.sa isolates
 * reputation while keeping alignment; it must not be intro.sa itself.
 */
export const RADAR_SENDER_ENV = "RADAR_SMTP_FROM";
export const RADAR_ENABLED_ENV = "RADAR_BROADCAST_ENABLED";

function domainOf(address: string): string {
  return address.split("@").pop()?.trim().toLowerCase() ?? "";
}

/**
 * Whether an issue can go out, and if not, exactly why.
 *
 * Pure and env-driven so the console can render the answer without attempting
 * a send, and so the rule is testable without a mail server.
 */
export function broadcastPlan(
  env: Record<string, string | undefined> = process.env,
): BroadcastPlan {
  const from = env[RADAR_SENDER_ENV]?.trim();
  const enabled = env[RADAR_ENABLED_ENV] === "1" || env[RADAR_ENABLED_ENV] === "true";

  if (!from) {
    return {
      enabled: false, refusal: "no_radar_sender", sender: null,
      reason:
        `${RADAR_SENDER_ENV} is not set. Radar needs its own sending subdomain — it must not ` +
        "ride pool 1, which carries sign-in codes. See docs/sending-domains.md.",
    };
  }

  // The guard that matters: a subdomain isolates reputation, the bare domain
  // does not. `mail@intro.sa` here would be pool 1 wearing a different name.
  const domain = domainOf(from);
  if (domain === "intro.sa" || !domain.endsWith(".intro.sa")) {
    return {
      enabled: false, refusal: "no_radar_sender", sender: from,
      reason:
        `${RADAR_SENDER_ENV} is ${from}. Radar must send from a subdomain of intro.sa ` +
        "(e.g. radar.intro.sa) so a complaint on the briefing cannot reach the domain " +
        "carrying sign-in codes.",
    };
  }

  if (!enabled) {
    return {
      enabled: false, refusal: "disabled", sender: from,
      reason: `${RADAR_ENABLED_ENV} is off. The issue is published to its public page; no mail is sent.`,
    };
  }

  return { enabled: true, refusal: null, sender: from, reason: "Radar broadcast is enabled." };
}
