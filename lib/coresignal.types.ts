/**
 * The vendor types that outlive a vendor call.
 *
 * Split out of lib/coresignal.ts because that module is `server-only` — it
 * holds the API key — while `EmailStatus` is stored on a row, read by the
 * schema, rendered in the UI and asserted in tests. Importing the client just
 * to name a string union would drag the key-bearing module into the schema,
 * the migration runner and every client component that shows a badge.
 */

/**
 * How the vendor arrived at an address, and therefore how far it may be
 * trusted. Only `verified` means the mailbox was checked; the rest are
 * inference, and `guessed_common_pattern` is a guess in the literal sense.
 */
export type EmailStatus =
  | "verified"
  | "matched_email"
  | "matched_pattern"
  | "guessed_common_pattern";

export const EMAIL_STATUSES: readonly EmailStatus[] = [
  "verified",
  "matched_email",
  "matched_pattern",
  "guessed_common_pattern",
];

/**
 * Whether an address may be treated as a real mailbox.
 *
 * The whole point of storing the status: a `guessed_common_pattern` address is
 * a pattern someone's domain *usually* follows, applied to a name. Sending to
 * it is sending to a guess, and a bounce on an unsolicited message is
 * reputation damage on a domain that also carries our own login mail.
 */
export function isUsableEmail(status: EmailStatus | null | undefined): boolean {
  return status === "verified" || status === "matched_email";
}

/** Arabic label per status, used by the review UI and the people table. */
export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  verified: "بريد موثّق",
  matched_email: "بريد مطابق",
  matched_pattern: "نمط مطابق — غير موثّق",
  guessed_common_pattern: "تخمين نمط — غير موثّق",
};
