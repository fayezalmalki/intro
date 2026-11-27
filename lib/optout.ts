import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Opt-out links in outreach: the address plus an HMAC, so the link opts out
 * exactly that address and can't be forged for someone else's.
 */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function optOutToken(email: string, secret: string): string {
  const e = email.trim().toLowerCase();
  return `${b64(e)}.${createHmac("sha256", secret).update(`optout:${e}`).digest("base64url").slice(0, 32)}`;
}

/** The address a token opts out, or null if it was tampered with. */
export function readOptOutToken(token: string, secret: string): string | null {
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  let email: string;
  try { email = unb64(p); } catch { return null; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const want = optOutToken(email, secret).split(".")[1];
  const a = Buffer.from(sig), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}
