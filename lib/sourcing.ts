import type { Brief, Evidence, Fit, Person, PipelineItem } from "./types";

/**
 * Sourced signals per person. In production these come from the enrichment
 * pipeline; here they are seeded so the generated draft carries real citations
 * and the no-evidence approval block is exercisable.
 */
const SIGNALS: Record<
  string,
  {
    why: string;
    whyNow: string;
    timing: "high" | "medium" | "low";
    leadWith: string;
    avoid: string;
    opener: string;
    evidence: Evidence[];
  }
> = {
  "p-noura": {
    why: "تبني فريق منتج جديد بعد جولة تمويل، وتوظف مباشرة لأدوار قيادية بدون مرور على التوظيف.",
    whyNow: "الشركة أعلنت جولة تمويل في يونيو وفتحت ثلاثة أدوار في المنتج منها دور قيادي واحد.",
    timing: "high",
    leadWith: "مشكلة محددة حليتها في منتج مدفوعات، وأثرها بالأرقام.",
    avoid: "إرسال السيرة الذاتية كأول رسالة.",
    opener: "هلا نورة، تابعت توسّع فريق المنتج عندكم بعد الجولة الأخيرة. عملت آخر ثلاث سنوات على منتجات مدفوعات B2B، وآخر شيء أنجزته كان تقليص وقت التسوية من ٤٨ ساعة إلى ٦.",
    evidence: [
      { url: "https://example.com/funding", title: "إعلان جولة التمويل وتوسّع الفريق", source: "argaam.com", date: "١٢ يونيو", assertedBy: "ai" },
      { url: "https://example.com/careers", title: "ثلاثة أدوار منتج مفتوحة، منها دور قيادي", source: "الموقع الوظيفي", date: "٣ أغسطس", assertedBy: "ai" },
    ],
  },
  "p-faisal-d": {
    why: "الفريق نما من ٤ إلى ١١ خلال سنة. احتمال فتح دور قيادي وسيط قائم لكنه غير معلن.",
    whyNow: "النمو السريع عادةً يسبق فتح طبقة قيادية وسيطة، وهذا يجعل التواصل المبكر مفيدًا.",
    timing: "medium",
    leadWith: "خبرة في بناء فريق منتج من الصفر داخل بيئة عمليات.",
    avoid: "مقارنة شركتهم بشركات لوجستيات عالمية.",
    opener: "هلا فيصل، شفت نمو فريق المنتج عندكم هذه السنة. بنيت فريق منتج من شخصين إلى تسعة في شركة عمليات مشابهة، وأعرف وين تصير الفوضى في هذه المرحلة.",
    evidence: [
      { url: "https://example.com/post", title: "منشور عن نمو فريق المنتج", source: "linkedin.com", date: "٢٩ يوليو", assertedBy: "ai" },
    ],
  },
  "p-abdullah": {
    why: "يملك صورة كاملة عن الأدوار القيادية قبل نشرها، وهو أقرب مسار للشركات الكبيرة في المجموعة.",
    whyNow: "المجموعة تعيد هيكلة ثلاث وحدات رقمية، وهذا عادة يسبق فتح أدوار قيادية في المنتج.",
    timing: "high",
    leadWith: "وضوح في نوع الدور اللي تبحث عنه ومستوى المسؤولية.",
    avoid: "الرسائل العامة. هو يستقبل عشرات منها يوميًا.",
    opener: "هلا عبدالله، أبحث عن دور قيادي في المنتج داخل وحدة رقمية لها منتج قائم وعملاء. خبرتي ست سنوات في المنتج منها ثلاث في القيادة.",
    evidence: [
      { url: "https://example.com/restructure", title: "إعادة هيكلة ثلاث وحدات رقمية", source: "بيان المجموعة", date: "١٨ يوليو", assertedBy: "ai" },
    ],
  },
  "p-sara": {
    why: "الدور القيادي عندها مشغول، لكنها تبني طبقة إدارة وسطى جديدة تحتها.",
    whyNow: "لا يوجد إعلان توظيف حالي. التواصل هنا استثمار طويل الأجل أكثر من فرصة قائمة.",
    timing: "low",
    leadWith: "اهتمام حقيقي بمجال الصحة الرقمية، لا بالشركة كوجهة عمل.",
    avoid: "السؤال المباشر عن وظيفة متاحة.",
    opener: "هلا سارة، أتابع اللي تبنونه في الصحة الرقمية. خلفيتي في المنتج داخل قطاعات منظمة، وحبيت أتواصل معك حتى لو ما كان فيه شيء متاح حاليًا.",
    evidence: [
      { url: "https://example.com/podcast", title: "حديث عن هيكلة فريق المنتج", source: "بودكاست", date: "مايو", assertedBy: "ai" },
    ],
  },
  "p-layan": {
    why: "فتحت دورًا قياديًا في المنتج هذا الأسبوع ولم يُعلن بعد.",
    whyNow: "الدور غير منشور، وهذا يعني منافسة أقل إذا وصلت مبكرًا.",
    timing: "high",
    leadWith: "خبرة في منتجات منظمة وقريبة من الامتثال.",
    avoid: "الحديث عن الراتب في أول رسالة.",
    opener: "هلا ليان، وصلني أنكم تبنون طبقة قيادية جديدة في المنتج. خلفيتي في منتجات مالية منظمة، وحبيت أتواصل معك قبل ما يُنشر الدور.",
    evidence: [
      { url: "https://example.com/hiring", title: "إشارة إلى دور قيادي قادم في المنتج", source: "مصدر داخلي موثّق", date: "هذا الأسبوع", assertedBy: "am" },
    ],
  },
  "p-tariq": {
    why: "مسؤول الشراكات الرقمية في البنك، وأقرب نقطة دخول لأي منتج يبيع للبنوك.",
    whyNow: "البنك أعلن عن توسّع في قنوات Open Banking هذا الربع.",
    timing: "high",
    leadWith: "حالة استخدام محددة مع أرقام، لا عرض منتج عام.",
    avoid: "طلب اجتماع بدون سياق.",
    opener: "هلا طارق، أعمل على منصة مدفوعات تتكامل مع قنوات Open Banking. عندي حالة استخدام محددة أعتقد أنها قريبة من اللي تشتغلون عليه.",
    evidence: [
      { url: "https://example.com/openbanking", title: "توسّع قنوات Open Banking", source: "بيان صحفي", date: "أغسطس", assertedBy: "ai" },
    ],
  },
  "p-hessa": {
    why: "تدير Open Banking مباشرة، وتملك قرار التجربة الفنية قبل الشراء.",
    whyNow: "الفريق يقيّم مزوّدين جدد هذا الربع.",
    timing: "medium",
    leadWith: "التكامل الفني ووقت التنفيذ.",
    avoid: "الحديث التجاري قبل الفني.",
    opener: "هلا حصة، أعمل على تكامل مع Open Banking وحبيت أعرف كيف تقيّمون المزوّدين الجدد حاليًا.",
    evidence: [
      { url: "https://example.com/vendors", title: "تقييم مزوّدين جدد", source: "مقابلة", date: "يوليو", assertedBy: "ai" },
    ],
  },
  "p-omar": {
    why: "يستثمر في المرحلة المبكرة داخل السوق السعودي، وقاد جولات في قطاعات قريبة.",
    whyNow: "الصندوق أعلن عن دورة استثمارية جديدة.",
    timing: "medium",
    leadWith: "الجر والأرقام، لا الفكرة.",
    avoid: "إرسال عرض تقديمي كامل كأول رسالة.",
    opener: "هلا عمر، نبني منتجًا في مرحلة مبكرة وعندنا جر مبدئي. حبيت أشاركك ملخصًا قصيرًا إذا كان القطاع ضمن اهتماماتكم.",
    evidence: [
      { url: "https://example.com/fund", title: "إعلان دورة استثمارية جديدة", source: "بيان الصندوق", date: "يونيو", assertedBy: "ai" },
    ],
  },
};

/** People we know of but have no sourced signal for — genuinely thin. */
const THIN_FALLBACK = {
  why: "عرفناه من ملف عام واحد. المسمى مناسب، لكن معلوماتنا عنه أقل من الباقي.",
  whyNow: "ما لقينا أخبار حديثة عن الشركة ولا إعلانات توظيف، فلا يوجد سياق توقيت.",
  leadWith: "سؤال قصير وواضح. المعلومات الناقصة تعني أن الرسالة الطويلة مخاطرة.",
  avoid: "افتراض حجم الفريق أو مرحلة الشركة.",
  opener: "هلا، شفت أنك تقود المنتج في شركتكم. أعمل في نفس المجال وحبيت أسألك مباشرة إذا فيه شيء قادم يناسب.",
};

const TIMING_LABEL: Record<"high" | "medium" | "low" | "none", string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
  none: "غير معروف",
};

function score(person: Person, brief: Brief): number {
  let s = 0;
  if (brief.industries.some((i) => person.industries.includes(i))) s += 2;
  if (brief.geos.length === 0 || brief.geos.includes("السعودية")) s += 1;
  if (brief.targetRoles.some((r) => roleMatches(r, person))) s += 3;
  if (brief.seniority.includes("قيادي") && ["vp", "head", "cxo", "partner", "director"].includes(person.seniority)) s += 1;
  return s;
}

function roleMatches(role: string, person: Person): boolean {
  if (role.includes("منتج")) return person.title.includes("المنتج") || person.title.includes("منتج");
  if (role.includes("تسويق")) return person.title.includes("تسويق");
  if (role.includes("شراكات")) return person.title.includes("شراكات");
  if (role.includes("توظيف")) return person.title.includes("توظيف");
  if (role.includes("Open Banking")) return person.title.includes("Open Banking") || person.industries.includes("بنوك");
  return false;
}

/**
 * The rubric from docs/01-mvp-plan.md: `strong` needs role and company match
 * *plus* a live timing signal. Without dated evidence of something happening
 * now, the best a row can claim is `medium` — and a long-horizon contact with
 * no opening is `possible`, whatever its title match.
 */
function fitFor(s: number, timing: "high" | "medium" | "low" | "none"): Fit {
  if (timing === "none" || timing === "low") return "possible";
  if (s >= 5 && timing === "high") return "strong";
  if (s >= 3) return "medium";
  return "possible";
}

export function generateDraft(brief: Brief, people: Person[]): Omit<PipelineItem, "id">[] {
  return people
    .map((p) => ({ p, s: score(p, brief) }))
    .filter(({ s }) => s >= 3)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map(({ p, s }, i) => {
      const sig = SIGNALS[p.id];
      const evidence = sig?.evidence ?? [];
      const copy = sig ?? THIN_FALLBACK;
      return {
        personId: p.id,
        rank: i + 1,
        fit: fitFor(s, sig ? sig.timing : "none"),
        thin: evidence.length === 0,
        why: copy.why,
        whyNow: copy.whyNow,
        roleRelevance: s >= 5 ? "عالية" : s >= 3 ? "متوسطة" : "منخفضة",
        companyRelevance: brief.industries.some((x) => p.industries.includes(x)) ? "عالية" : "متوسطة",
        timing: TIMING_LABEL[sig ? sig.timing : "none"],
        leadWith: copy.leadWith,
        avoid: copy.avoid,
        opener: copy.opener,
        channel: p.emailVerified ? ("email" as const) : ("linkedin" as const),
        status: "proposed" as const,
        evidence,
        generatedBy: "ai" as const,
      };
    });
}

/**
 * An item may only be approved once at least one claim is backed by a source.
 * A row with no evidence must have one added, or be removed.
 */
export function canApprove(item: { evidence: Evidence[] }): boolean {
  return item.evidence.length > 0;
}
