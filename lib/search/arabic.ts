import { ROLES, SECTORS } from "../sourcing/vocabulary";
import { DICTIONARY } from "./dictionary";

/**
 * Arabic search words → what the data providers understand.
 *
 * Providers index companies and people in English, so «شركة تقنية» searched
 * as typed finds nothing. This strips the filler a person naturally types
 * («شركات», «في السوق السعودي»), turns a sector word into the industry
 * providers file under, and translates the common descriptive words. Fixed
 * tables, so a search is predictable and testable.
 */

const ARABIC = /[؀-ۿ]/;
export const hasArabic = (s: string) => ARABIC.test(s);

/** Words that carry no search meaning on their own. */
const FILLER = new Set([
  "شركة", "شركات", "الشركات", "الشركة", "جهة", "جهات", "الجهات", "مؤسسة", "مؤسسات", "منشأة", "منشآت",
  "في", "من", "على", "الى", "إلى", "عن", "مع", "و", "او", "أو", "اللي", "التي", "الذي", "اللتي",
  "السوق", "سوق", "السعودي", "السعودية", "بالسعودية", "المملكة", "الخليج", "الخليجي", "الرياض", "جدة", "الدمام",
  "دخلت", "حديثا", "حديثًا", "جديد", "جديدة", "تعمل", "تشتغل", "مجال", "قطاع",
  // Seniority words: people searches already favour decision makers.
  "مدير", "مدراء", "مديري", "رئيس", "رؤساء", "مسؤول", "مسؤولي", "مسؤولو", "قائد", "قادة",
  "خاص", "خاصة", "كبرى", "كبيرة", "كبار",
]);

/** Common descriptive words, Arabic → English provider terms. */
const TERMS: [string[], string][] = [
  [["ذكاء اصطناعي", "الذكاء الاصطناعي"], "artificial intelligence"],
  [["أمن سيبراني", "الأمن السيبراني", "سيبراني"], "cybersecurity"],
  [["برمجيات", "سوفتوير"], "software"],
  [["ناشئة", "الناشئة", "ستارتب"], "startups"],
  [["عالمية", "العالمية", "دولية"], "international"],
  [["أغذية", "اغذية", "غذائية", "مطاعم"], "food and beverage"],
  [["مقاولات", "بناء", "إنشاءات", "انشاءات"], "construction"],
  [["سياحة", "فنادق", "ضيافة"], "hospitality and tourism"],
  [["تصنيع", "مصانع", "صناعة"], "manufacturing"],
  [["سيارات"], "automotive"],
  [["استشارات", "استشارية"], "consulting"],
  [["إعلام", "اعلام", "إعلان", "وكالات"], "media and advertising"],
  [["تجارة إلكترونية", "تجارة الكترونية", "متاجر"], "e-commerce"],
  [["ألعاب", "العاب"], "gaming"],
  [["رياضة", "رياضية"], "sports"],
  [["أدوية", "ادوية", "صيدليات"], "pharmaceuticals"],
  [["تمويل", "إقراض", "اقراض"], "lending"],
  [["رواتب"], "payroll"],
  [["مدفوعات"], "payments"],
];

/** Normalises alef forms and strips diacritics and the definite article, per word, for matching. */
const norm = (w: string) => w.replace(/[\u064B-\u0652]/g, "").replace(/[إأآ]/g, "ا").replace(/ة$/, "ه").replace(/^(وال|بال|لل|ال)(?=..)/, "");
const normText = (t: string) => t.split(/\s+/).filter(Boolean).map(norm).join(" ");

/** Plurals and forms the sector table does not list. */
const EXTRA_SECTORS: { m: string; industry: string }[] = [
  { m: "مستشفيات", industry: "Hospital & Health Care" },
  { m: "صحية", industry: "Hospital & Health Care" },
  { m: "مصارف", industry: "Banking" },
  { m: "عقارات", industry: "Real Estate" },
  { m: "مدارس", industry: "Education Management" },
  { m: "جامعات", industry: "Education Management" },
  { m: "شركات تامين", industry: "Insurance" },
  // Every Arabic synonym in the sector dictionary, too.
  ...DICTIONARY.flatMap((d) => d.synonymsAr.map((m) => ({ m, industry: d.id }))),
];

/** Sector words, longest first, so «تقنية مالية» wins over «تقنية». */
const SECTOR_WORDS = [...SECTORS.flatMap((s) => s.match.filter(hasArabic).map((m) => ({ m, industry: s.industry }))), ...EXTRA_SECTORS]
  .map((x) => ({ ...x, m: normText(x.m) }))
  .sort((a, b) => b.m.length - a.m.length);

export interface ProviderTerms {
  /** English words to search with (may be empty). */
  terms: string;
  /** An industry, when a sector word was recognised. */
  industry?: string;
  /** Role words found («مدير المشتريات» → Procurement), for people searches. */
  titles: string[];
  /** Arabic words we could not translate. */
  untranslated: string[];
}

const ROLE_WORDS = ROLES.flatMap((r) => r.match.filter(hasArabic).map((m) => ({ m: normText(m), title: r.title })))
  .sort((a, b) => b.m.length - a.m.length);

export function toProviderTerms(text: string): ProviderTerms {
  let rest = ` ${normText(text)} `;
  const english: string[] = [];
  let industry: string | undefined;

  for (const { m, industry: ind } of SECTOR_WORDS) {
    if (rest.includes(` ${m} `)) {
      industry ??= ind;
      rest = rest.replaceAll(` ${m} `, "  ");
    }
  }
  const titles: string[] = [];
  for (const { m, title } of ROLE_WORDS) {
    if (rest.includes(` ${m} `)) {
      if (!titles.includes(title)) titles.push(title);
      rest = rest.replaceAll(` ${m} `, "  ");
    }
  }
  for (const [words, en] of TERMS) {
    for (const w of words.map(normText).sort((a, b) => b.length - a.length)) {
      if (rest.includes(` ${w} `)) {
        if (!english.includes(en)) english.push(en);
        rest = rest.replaceAll(` ${w} `, "  ");
      }
    }
  }
  const fillers = new Set([...FILLER].map(norm));
  // A sector or term matched inside a word can leave its article («ال») behind.
  const leftover = rest.split(/[\s،,.]+/).filter((w) => w && !(hasArabic(w) && w.length < 2)).filter((w) => !fillers.has(norm(w)));
  const latin = leftover.filter((w) => !hasArabic(w));
  const untranslated = leftover.filter(hasArabic);
  return { terms: [...english, ...latin].join(" "), industry, titles, untranslated };
}
