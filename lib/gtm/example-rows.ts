import type { EmailStatus } from "../coresignal.types";

/**
 * Hand-written people, for a development environment with no Coresignal key.
 *
 * They exist so the review screen — the email gate, the drafts, the approval
 * states — can be walked and judged at all. Without a key there are no names to
 * walk it with, because a name is a 20-credit purchase.
 *
 * Every row is stored `source: "fixture"` and every screen that renders one
 * says «صفوف مثال — ليست من مزوّد بيانات» above it. The label is on the row and
 * not on the feature flag on purpose: a build that somehow enabled these still
 * cannot present them as vendor results.
 *
 * The four `primary_professional_email_status` values are deliberately spread
 * across the set, because the whole point of the review screen is that they are
 * not interchangeable — and the last one, a literal guess, is the row that has
 * to look different from the others.
 */
export interface ExamplePerson {
  fullName: string;
  firstName: string;
  title: string;
  email: string | null;
  emailStatus: EmailStatus | null;
}

export const EXAMPLE_PEOPLE: readonly ExamplePerson[] = [
  {
    fullName: "نورة العتيبي",
    firstName: "نورة",
    title: "مديرة المبيعات",
    email: "noura@example.sa",
    emailStatus: "verified",
  },
  {
    fullName: "طارق الحربي",
    firstName: "طارق",
    title: "رئيس تطوير الأعمال",
    email: "t.alharbi@example.sa",
    emailStatus: "matched_email",
  },
  {
    fullName: "سارة القحطاني",
    firstName: "سارة",
    title: "مديرة العمليات",
    email: "s.alqahtani@example.sa",
    emailStatus: "matched_pattern",
  },
  {
    fullName: "عبدالله الشمري",
    firstName: "عبدالله",
    title: "مدير تقنية المعلومات",
    // A guess in the literal sense: the domain's usual pattern applied to a
    // name. The review screen must never treat this as an address.
    email: "abdullah.alshamri@example.sa",
    emailStatus: "guessed_common_pattern",
  },
  {
    fullName: "ليان الدوسري",
    firstName: "ليان",
    title: "مديرة الشراكات",
    // No address at all — the other half of the gate.
    email: null,
    emailStatus: null,
  },
];
