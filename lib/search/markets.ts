/** Markets a search can target. Saudi first: it is the product's home. */
export const MARKETS = {
  SA: { en: "Saudi Arabia", ar: "السعودية", location: "Saudi Arabia" },
  AE: { en: "UAE", ar: "الإمارات", location: "United Arab Emirates" },
  QA: { en: "Qatar", ar: "قطر", location: "Qatar" },
  KW: { en: "Kuwait", ar: "الكويت", location: "Kuwait" },
  BH: { en: "Bahrain", ar: "البحرين", location: "Bahrain" },
  OM: { en: "Oman", ar: "عُمان", location: "Oman" },
  EG: { en: "Egypt", ar: "مصر", location: "Egypt" },
  JO: { en: "Jordan", ar: "الأردن", location: "Jordan" },
} as const;

export type Market = keyof typeof MARKETS;
export const isMarket = (m: unknown): m is Market => typeof m === "string" && m in MARKETS;

/** Sectors as providers file them, with how we say them. */
export const SECTOR_OPTIONS = [
  { id: "Banking", en: "Banking", ar: "البنوك" },
  { id: "Insurance", en: "Insurance", ar: "التأمين" },
  { id: "Financial Services", en: "Fintech & financial services", ar: "التقنية المالية" },
  { id: "Hospital & Health Care", en: "Healthcare", ar: "الرعاية الصحية" },
  { id: "Retail", en: "Retail", ar: "التجزئة" },
  { id: "Government Administration", en: "Government", ar: "الجهات الحكومية" },
  { id: "Real Estate", en: "Real estate", ar: "العقار" },
  { id: "Logistics and Supply Chain", en: "Logistics", ar: "الخدمات اللوجستية" },
  { id: "Telecommunications", en: "Telecom", ar: "الاتصالات" },
  { id: "Oil & Energy", en: "Energy", ar: "الطاقة" },
  { id: "Information Technology & Services", en: "Technology", ar: "التقنية" },
  { id: "Education Management", en: "Education", ar: "التعليم" },
  { id: "Venture Capital & Private Equity", en: "Investors (VC & PE)", ar: "صناديق الاستثمار" },
] as const;

/** Seniority quick filters → the title fragment providers match. */
export const SENIORITY_OPTIONS = [
  { id: "Chief", en: "C-level", ar: "الإدارة التنفيذية" },
  { id: "Head", en: "Head / VP", ar: "رؤساء الأقسام" },
  { id: "Director", en: "Director", ar: "المدراء" },
  { id: "Manager", en: "Manager", ar: "مدراء الإدارات" },
  { id: "Partner", en: "Partner", ar: "الشركاء" },
] as const;
