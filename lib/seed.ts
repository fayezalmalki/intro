import type { Db, Person, PeopleList } from "./types";

const P = (p: Person) => p;

export const SEED_PEOPLE: Person[] = [
  P({
    id: "p-noura", latin: "NOURA A.", firstAr: "نورة",
    title: "مديرة المنتج", company: "منصة مدفوعات", geo: "الرياض",
    industries: ["تقنية مالية", "تقنية"], seniority: "director",
    linkedinUrl: "linkedin.com/in/noura-a-product",
    email: "noura@example.sa", emailVerified: true, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-faisal-d", latin: "FAISAL D.", firstAr: "فيصل",
    title: "نائب رئيس المنتج", company: "شركة لوجستيات", geo: "الرياض",
    industries: ["لوجستيات", "تقنية"], seniority: "vp",
    linkedinUrl: "linkedin.com/in/faisal-d-vp-product",
    emailVerified: false, openToIntros: false, source: "seed",
  }),
  P({
    id: "p-abdullah", latin: "ABDULLAH H.", firstAr: "عبدالله",
    title: "رئيس التوظيف التقني", company: "مجموعة تقنية", geo: "جدة",
    industries: ["تقنية"], seniority: "head",
    linkedinUrl: "linkedin.com/in/abdullah-h-talent",
    email: "abdullah@example.sa", emailVerified: true, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-sara", latin: "SARA Q.", firstAr: "سارة",
    title: "الرئيسة التنفيذية للمنتج", company: "شركة تقنية صحية", geo: "الرياض",
    industries: ["تقنية صحية", "تقنية"], seniority: "cxo",
    linkedinUrl: "linkedin.com/in/sara-q-cpo",
    emailVerified: false, openToIntros: false, source: "seed",
  }),
  P({
    id: "p-salman", latin: "S. ALMUTAIRI", firstAr: "سلمان",
    title: "رئيس المنتج", company: "شركة برمجيات", geo: "الخبر",
    industries: ["تقنية"], seniority: "head",
    linkedinUrl: "linkedin.com/in/s-almutairi",
    emailVerified: false, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-layan", latin: "LAYAN M.", firstAr: "ليان",
    title: "رئيسة المنتج", company: "شركة تأمين رقمي", geo: "الرياض",
    industries: ["تأمين", "تقنية مالية"], seniority: "head",
    linkedinUrl: "linkedin.com/in/layan-m-product",
    email: "layan@example.sa", emailVerified: true, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-tariq", latin: "TARIQ B.", firstAr: "طارق",
    title: "رئيس الشراكات الرقمية", company: "بنك محلي", geo: "الرياض",
    industries: ["بنوك", "تقنية مالية"], seniority: "head",
    linkedinUrl: "linkedin.com/in/tariq-b-partnerships",
    email: "tariq@example.sa", emailVerified: true, openToIntros: false, source: "seed",
  }),
  P({
    id: "p-hessa", latin: "HESSA K.", firstAr: "حصة",
    title: "مديرة Open Banking", company: "بنك رقمي", geo: "الرياض",
    industries: ["بنوك", "تقنية مالية"], seniority: "director",
    linkedinUrl: "linkedin.com/in/hessa-k-openbanking",
    email: "hessa@example.sa", emailVerified: true, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-omar", latin: "OMAR Z.", firstAr: "عمر",
    title: "شريك، مرحلة مبكرة", company: "صندوق استثماري", geo: "الرياض",
    industries: ["استثمار"], seniority: "partner",
    linkedinUrl: "linkedin.com/in/omar-z-vc",
    email: "omar@example.sa", emailVerified: true, openToIntros: true, source: "seed",
  }),
  P({
    id: "p-reem-s", latin: "REEM S.", firstAr: "ريم",
    title: "مديرة منتج أولى", company: "شركة تأمين", geo: "الرياض",
    industries: ["تأمين"], seniority: "manager",
    linkedinUrl: "linkedin.com/in/reem-s-product",
    emailVerified: false, openToIntros: false, source: "seed",
  }),
];

export const SEED_LISTS: PeopleList[] = [
  {
    id: "l-fintech-product",
    name: "قادة المنتج في التقنية المالية",
    desc: "مدير منتج وأعلى، في شركات مرخّصة من ساما.",
    personIds: ["p-noura", "p-layan", "p-hessa"],
  },
  {
    id: "l-tech-talent",
    name: "التوظيف التقني في ٥٠٠+",
    desc: "رؤساء التوظيف التقني في الشركات الكبيرة.",
    personIds: ["p-abdullah"],
  },
  {
    id: "l-insurance-partnerships",
    name: "الشراكات في التأمين",
    desc: "مسؤولو الشراكات والقنوات الرقمية في شركات التأمين.",
    personIds: ["p-layan", "p-reem-s"],
  },
  {
    id: "l-banking-openbanking",
    name: "Open Banking في البنوك",
    desc: "المسؤولون عن Open Banking والشراكات الرقمية في البنوك.",
    personIds: ["p-tariq", "p-hessa"],
  },
];

export function emptyDb(): Db {
  return {
    people: SEED_PEOPLE.map((p) => ({ ...p })),
    requests: [],
    pipelines: [],
    outreach: [],
    lists: SEED_LISTS.map((l) => ({ ...l, personIds: [...l.personIds] })),
    audit: [],
  };
}
