import type { DraftTemplate, ExampleCompany } from "../types";
import type { Recipient, SegmentContext, Sender } from "./compose";
import { compose, TEMPLATES, type ComposedDraft } from "./compose";

/**
 * Worked examples, so the writing can be judged on the first load.
 *
 * The whole point of this file is that it needs no API key, no Coresignal
 * credit and no database row: `/examples` renders real composer output over
 * this data, which is the only honest way to show what the drafts read like
 * before anyone has signed up.
 *
 * Two rules about what is in here, both load-bearing:
 *
 *   • The **sender** is intro.sa itself. Putting a real third-party company in
 *     the sender's chair would be borrowing someone's name to sell a demo.
 *   • The **recipients** are written by hand and labelled as written by hand.
 *     They are not scraped, not vendor-sourced, and the page says so in as many
 *     words. A fabricated person presented as a real lookup is exactly the kind
 *     of thing the honesty rule exists to stop — the fix is the label, and the
 *     label is not optional.
 *
 * The last recipient carries nothing but a name on purpose. It is the case the
 * composer has to get right: no title, no company, no headcount, so the letter
 * admits it instead of inventing a reason for the approach.
 */

export const EXAMPLE_SENDER: Sender = {
  company: "Intro",
  person: "فايز",
  sells: "نساعد الفرق السعودية توصل لصاحب القرار الصح برسالة تخصّه هو، بدل قوائم باردة",
  sellsEn:
    "we help Saudi teams reach the actual decision maker with a letter written for them, instead of a cold list",
  website: "intro.sa",
  market: "السعودية",
};

export const EXAMPLE_SEGMENTS: readonly SegmentContext[] = [
  {
    name: "فرق المبيعات في شركات SaaS سعودية",
    nameEn: "Sales teams at Saudi SaaS companies",
    painEn:
      "the team burns its week assembling lists instead of talking to customers, and the messages come out generic, so nobody replies",
    pain: "الفريق يحرق أسبوعه في تجهيز القوائم بدل ما يتكلم مع العملاء، والرسائل تطلع عامة فما ترد",
    criteria: [
      "شركة برمجيات مقرّها السعودية",
      "من ٢٠ إلى ٢٠٠ موظف",
      "عندها فريق مبيعات خارجي قائم",
    ],
  },
  {
    name: "شركات اللوجستيات المتوسطة",
    nameEn: "Mid-size logistics companies",
    painEn:
      "selling to banks and retailers passes through four layers before it reaches the decision maker, and the cycle stretches to months",
    pain: "البيع للبنوك وشركات التجزئة يمر على أربع طبقات قبل ما يوصل صاحب القرار، والدورة تطول لشهور",
    criteria: [
      "شركة لوجستيات أو توصيل مقرّها السعودية",
      "أكثر من ٥٠ موظف",
      "تبيع لعملاء مؤسسيين",
    ],
  },
];

/** Written by hand, and labelled as such wherever they are rendered. */
export const EXAMPLE_RECIPIENTS: readonly (Recipient & { note: string })[] = [
  {
    fullName: "نورة العتيبي",
    firstName: "نورة",
    title: "مديرة المبيعات",
    titleEn: "Head of Sales",
    companyName: "شركة برمجيات سعودية (مثال)",
    companyNameEn: "a Saudi software company (example)",
    industry: "برمجيات كخدمة",
    employeesCount: 84,
    hqCountry: "السعودية",
    note: "كل الحقول موجودة: مسمى، شركة، قطاع، وحجم فريق.",
  },
  {
    fullName: "طارق الحربي",
    firstName: "طارق",
    title: "رئيس تطوير الأعمال",
    titleEn: "Head of Business Development",
    companyName: "شركة لوجستيات (مثال)",
    companyNameEn: "a logistics company (example)",
    employeesCount: null,
    hqCountry: "السعودية",
    note: "بدون حجم فريق — فالرسالة ما تذكر رقمًا ما عندنا مصدر له.",
  },
  {
    fullName: "عبدالله الشمري",
    note: "اسم فقط. هذي الحالة اللي تكشف المؤلف: الرسالة تقصر وتعترف، ما تخترع سببًا.",
  },
];

export interface WorkedExample {
  template: DraftTemplate;
  labelAr: string;
  askAr: string;
  recipient: Recipient & { note: string };
  segment: SegmentContext;
  draft: ComposedDraft;
}

/**
 * One example per template, plus the thin case.
 *
 * Composed at call time rather than stored as strings: a change to the composer
 * that quietly degrades the writing shows up on this page immediately, which is
 * the only way a worked example stays worth reading.
 */
export function workedExamples(): WorkedExample[] {
  const pairs: { template: DraftTemplate; recipient: number; segment: number }[] = [
    { template: "direct", recipient: 0, segment: 0 },
    { template: "warm_intro", recipient: 1, segment: 1 },
    { template: "partnership", recipient: 1, segment: 1 },
    { template: "direct", recipient: 2, segment: 0 },
  ];

  return pairs.map(({ template, recipient, segment }) => {
    const meta = TEMPLATES.find((t) => t.id === template)!;
    const person = EXAMPLE_RECIPIENTS[recipient];
    const seg = EXAMPLE_SEGMENTS[segment];
    return {
      template,
      labelAr: meta.labelAr,
      askAr: meta.askAr,
      recipient: person,
      segment: seg,
      draft: compose({ sender: EXAMPLE_SENDER, recipient: person, segment: seg, template }),
    };
  });
}

/** Competitor tiles for the example profile — named products, nothing invented. */
export const EXAMPLE_COMPETITORS: readonly ExampleCompany[] = [
  { name: "Apollo", website: "apollo.io" },
  { name: "Clay", website: "clay.com" },
  { name: "Lusha", website: "lusha.com" },
];
