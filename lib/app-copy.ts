import type { RequestStatus } from "./types";

/** How a request's state reads to the person who made it, in both languages. */
export const REQUEST_STATUS: Record<RequestStatus, { en: string; ar: string; tone: "neutral" | "brand" | "success" | "accent" | "sand" }> = {
  intent_review: { en: "Confirm your brief", ar: "بانتظار تأكيدك", tone: "accent" },
  in_sourcing: { en: "Finding people", ar: "نبحث الآن", tone: "sand" },
  pipeline_ready: { en: "Results ready", ar: "النتائج جاهزة", tone: "success" },
  outreach: { en: "Reaching out", ar: "التواصل جارٍ", tone: "brand" },
  closed: { en: "Closed", ar: "مغلق", tone: "neutral" },
};

export const GOAL_LABEL: Record<string, { en: string; ar: string }> = {
  job: { en: "Job", ar: "وظيفة" },
  sales: { en: "Sales", ar: "مبيعات" },
  partnership: { en: "Partnership", ar: "شراكة" },
  investment: { en: "Investment", ar: "استثمار" },
  person: { en: "A specific person", ar: "شخص محدد" },
};

export const FIT_LABEL: Record<string, { en: string; ar: string; tone: "success" | "brand" | "neutral" }> = {
  strong: { en: "Strong fit", ar: "توافق قوي", tone: "success" },
  medium: { en: "Good fit", ar: "توافق جيد", tone: "brand" },
  possible: { en: "Possible", ar: "محتمل", tone: "neutral" },
};

export const OUTREACH_LABEL: Record<string, { en: string; ar: string }> = {
  queued: { en: "Queued", ar: "في قائمة الإرسال" },
  sent: { en: "Sent — awaiting reply", ar: "أُرسلت، بانتظار الرد" },
  replied: { en: "Replied", ar: "ردّ عليك" },
  accepted: { en: "Accepted the intro", ar: "وافق على التعارف" },
  declined: { en: "Declined for now", ar: "اعتذر حاليًا" },
};
