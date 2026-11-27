/**
 * The sector dictionary: a starter for each sector people search in the Gulf.
 *
 * Built from public taxonomies — the LinkedIn industry names providers file
 * companies under (the `id`s), the activity groups used for Saudi commercial
 * registration, and how people in the market actually name these businesses
 * in Arabic. A starter is a ready set of criteria: sub-sectors (each a set of
 * English search terms providers match), the roles that decide, and the
 * signals that mean "now". People start from one and expand it, then save it
 * as their own (saved criteria). Arabic synonyms also feed the Arabic search
 * mapping, so «صناديق استثمار» and «شركات تأمين» land on the right industry.
 */

export interface SubSector { id: string; en: string; ar: string; terms: string }
export interface SectorRole { title: string; en: string; ar: string }
export interface SectorSignal { id: string; en: string; ar: string; terms: string }
export interface SectorStarter {
  id: string;
  en: string;
  ar: string;
  /** Other ways people write the sector in Arabic (plural, colloquial). */
  synonymsAr: string[];
  sub: SubSector[];
  roles: SectorRole[];
  signals: SectorSignal[];
}

const SIG = {
  hiring: { id: "hiring", en: "Hiring", ar: "يوظّفون", terms: "hiring" },
  funding: { id: "funding", en: "Raised funding", ar: "تمويل جديد", terms: "raises funding" },
  leader: { id: "leader", en: "New leadership", ar: "قيادة جديدة", terms: "appoints new CEO" },
  expansion: { id: "expansion", en: "Expanding", ar: "توسّع", terms: "expansion new branch" },
  tender: { id: "tender", en: "Tenders", ar: "مناقصات", terms: "tender RFP" },
  digital: { id: "digital", en: "Digital transformation", ar: "تحول رقمي", terms: "digital transformation" },
  regulation: { id: "regulation", en: "New regulation", ar: "تنظيم جديد", terms: "new regulation" },
  partnership: { id: "partnership", en: "New partnerships", ar: "شراكات جديدة", terms: "partnership agreement" },
} satisfies Record<string, SectorSignal>;

const R = (title: string, en: string, ar: string): SectorRole => ({ title, en, ar });
const S = (id: string, en: string, ar: string, terms: string): SubSector => ({ id, en, ar, terms });

export const DICTIONARY: SectorStarter[] = [
  {
    id: "Banking", en: "Banking", ar: "البنوك", synonymsAr: ["بنك", "بنوك", "مصرف", "مصارف", "مصرفية"],
    sub: [S("retail-banking", "Retail banking", "مصرفية الأفراد", "retail banking"), S("corporate-banking", "Corporate banking", "مصرفية الشركات", "corporate banking"), S("islamic-banking", "Islamic banking", "المصرفية الإسلامية", "islamic banking"), S("digital-banks", "Digital banks", "البنوك الرقمية", "digital bank")],
    roles: [R("Chief Digital", "Chief Digital Officer", "الرئيس الرقمي"), R("Retail Banking", "Head of Retail", "رئيس مصرفية الأفراد"), R("Procurement", "Procurement", "المشتريات"), R("Innovation", "Innovation", "الابتكار")],
    signals: [SIG.digital, SIG.regulation, SIG.partnership, SIG.hiring],
  },
  {
    id: "Insurance", en: "Insurance", ar: "التأمين", synonymsAr: ["تأمين", "شركات تأمين", "تكافل", "تامين"],
    sub: [S("health-insurance", "Health insurance", "التأمين الصحي", "health insurance"), S("motor-insurance", "Motor insurance", "تأمين المركبات", "motor insurance"), S("takaful", "Takaful", "التكافل", "takaful"), S("insurtech", "Insurtech", "تقنية التأمين", "insurtech")],
    roles: [R("Claims", "Head of Claims", "رئيس المطالبات"), R("Underwriting", "Underwriting", "الاكتتاب"), R("Chief Operating", "COO", "الرئيس التنفيذي للعمليات"), R("Chief Digital", "Chief Digital Officer", "الرئيس الرقمي")],
    signals: [SIG.digital, SIG.regulation, SIG.hiring, SIG.leader],
  },
  {
    id: "Financial Services", en: "Fintech & financial services", ar: "التقنية المالية", synonymsAr: ["تقنية مالية", "فنتك", "مدفوعات", "خدمات مالية"],
    sub: [S("payments", "Payments", "المدفوعات", "payments"), S("bnpl", "Buy now, pay later", "اشترِ الآن وادفع لاحقًا", "buy now pay later"), S("lending", "Lending", "التمويل والإقراض", "lending platform"), S("wealth", "Wealth & investing", "إدارة الثروات", "wealth management")],
    roles: [R("Chief Executive", "CEO / founder", "الرئيس التنفيذي"), R("Partnerships", "Partnerships", "الشراكات"), R("Product", "Product", "المنتج"), R("Compliance", "Compliance", "الالتزام")],
    signals: [SIG.funding, SIG.regulation, SIG.partnership, SIG.hiring],
  },
  {
    id: "Hospital & Health Care", en: "Healthcare", ar: "الرعاية الصحية", synonymsAr: ["صحة", "صحي", "صحية", "مستشفى", "مستشفيات", "مستوصف", "عيادات"],
    sub: [S("hospitals", "Private hospitals", "المستشفيات الخاصة", "private hospital"), S("clinics", "Clinics", "العيادات", "medical clinics"), S("pharma", "Pharmaceuticals", "الأدوية", "pharmaceutical"), S("healthtech", "Health tech", "التقنية الصحية", "healthtech")],
    roles: [R("Procurement", "Procurement", "المشتريات"), R("Medical Director", "Medical director", "المدير الطبي"), R("Chief Information", "CIO / IT", "التقنية"), R("Chief Executive", "CEO", "الرئيس التنفيذي")],
    signals: [SIG.expansion, SIG.tender, SIG.digital, SIG.hiring],
  },
  {
    id: "Retail", en: "Retail", ar: "التجزئة", synonymsAr: ["تجزئة", "متاجر", "سلاسل", "بيع بالتجزئة"],
    sub: [S("grocery", "Grocery & supermarkets", "البقالة والسوبرماركت", "supermarket chain"), S("fashion", "Fashion", "الأزياء", "fashion retail"), S("ecommerce", "E-commerce", "التجارة الإلكترونية", "e-commerce"), S("restaurants", "Restaurants & cafés", "المطاعم والمقاهي", "restaurant chain")],
    roles: [R("Chief Operating", "Operations", "العمليات"), R("Marketing", "Marketing", "التسويق"), R("Supply Chain", "Supply chain", "سلاسل الإمداد"), R("E-commerce", "E-commerce", "التجارة الإلكترونية")],
    signals: [SIG.expansion, SIG.hiring, SIG.digital, SIG.leader],
  },
  {
    id: "Government Administration", en: "Government", ar: "الجهات الحكومية", synonymsAr: ["حكومي", "حكومة", "وزارة", "وزارات", "هيئة", "هيئات"],
    sub: [S("ministries", "Ministries", "الوزارات", "ministry"), S("authorities", "Authorities", "الهيئات", "authority"), S("municipal", "Municipalities", "الأمانات والبلديات", "municipality"), S("giga", "Giga projects", "المشاريع الكبرى", "giga project")],
    roles: [R("Procurement", "Procurement", "المشتريات"), R("Digital Transformation", "Digital transformation", "التحول الرقمي"), R("Chief Information", "IT", "التقنية"), R("Strategy", "Strategy", "الاستراتيجية")],
    signals: [SIG.tender, SIG.digital, SIG.leader, SIG.regulation],
  },
  {
    id: "Real Estate", en: "Real estate", ar: "العقار", synonymsAr: ["عقار", "عقارات", "تطوير عقاري", "مطورين"],
    sub: [S("developers", "Developers", "المطورون العقاريون", "real estate developer"), S("proptech", "Proptech", "التقنية العقارية", "proptech"), S("facility", "Facility management", "إدارة المرافق", "facility management"), S("construction", "Construction", "المقاولات", "construction contractor")],
    roles: [R("Chief Executive", "CEO", "الرئيس التنفيذي"), R("Development", "Development", "التطوير"), R("Procurement", "Procurement", "المشتريات"), R("Sales", "Sales", "المبيعات")],
    signals: [SIG.expansion, SIG.tender, SIG.funding, SIG.partnership],
  },
  {
    id: "Logistics and Supply Chain", en: "Logistics", ar: "الخدمات اللوجستية", synonymsAr: ["لوجستيات", "لوجستية", "شحن", "نقل", "توصيل", "سلاسل إمداد"],
    sub: [S("3pl", "3PL & warehousing", "المستودعات", "3PL warehousing"), S("last-mile", "Last-mile delivery", "التوصيل للميل الأخير", "last mile delivery"), S("cold-chain", "Cold chain", "سلاسل التبريد", "cold chain logistics"), S("freight", "Freight", "الشحن", "freight forwarding")],
    roles: [R("Supply Chain", "Supply chain", "سلاسل الإمداد"), R("Operations", "Operations", "العمليات"), R("Procurement", "Procurement", "المشتريات"), R("Partnerships", "Partnerships", "الشراكات")],
    signals: [SIG.expansion, SIG.partnership, SIG.funding, SIG.tender],
  },
  {
    id: "Telecommunications", en: "Telecom", ar: "الاتصالات", synonymsAr: ["اتصالات", "شبكات", "مشغلين"],
    sub: [S("operators", "Operators", "المشغلون", "telecom operator"), S("iot", "IoT", "إنترنت الأشياء", "IoT"), S("data-centers", "Data centers", "مراكز البيانات", "data center"), S("enterprise", "Enterprise solutions", "حلول الأعمال", "enterprise solutions")],
    roles: [R("Chief Technology", "CTO", "الرئيس التقني"), R("Enterprise", "Enterprise sales", "قطاع الأعمال"), R("Procurement", "Procurement", "المشتريات"), R("Partnerships", "Partnerships", "الشراكات")],
    signals: [SIG.partnership, SIG.tender, SIG.digital, SIG.expansion],
  },
  {
    id: "Oil & Energy", en: "Energy", ar: "الطاقة", synonymsAr: ["طاقة", "نفط", "غاز", "طاقة متجددة", "كهرباء"],
    sub: [S("oil-gas", "Oil & gas", "النفط والغاز", "oil and gas"), S("renewables", "Renewables", "الطاقة المتجددة", "renewable energy solar"), S("utilities", "Utilities", "المرافق", "utilities"), S("oilfield", "Oilfield services", "خدمات الحقول", "oilfield services")],
    roles: [R("Procurement", "Procurement", "المشتريات"), R("Operations", "Operations", "العمليات"), R("HSE", "HSE", "السلامة"), R("Digital", "Digital", "الرقمي")],
    signals: [SIG.tender, SIG.expansion, SIG.partnership, SIG.digital],
  },
  {
    id: "Information Technology & Services", en: "Technology", ar: "التقنية", synonymsAr: ["تقنية", "تقنية معلومات", "برمجيات", "تقني", "شركات تقنية"],
    sub: [S("saas", "SaaS", "البرمجيات كخدمة", "SaaS"), S("ai", "AI", "الذكاء الاصطناعي", "artificial intelligence"), S("cyber", "Cybersecurity", "الأمن السيبراني", "cybersecurity"), S("system-integrators", "System integrators", "مكاملو الأنظمة", "system integrator")],
    roles: [R("Chief Technology", "CTO", "الرئيس التقني"), R("Founder", "Founders", "المؤسسون"), R("Partnerships", "Partnerships", "الشراكات"), R("Engineering", "Engineering", "الهندسة")],
    signals: [SIG.funding, SIG.hiring, SIG.partnership, SIG.expansion],
  },
  {
    id: "Education Management", en: "Education", ar: "التعليم", synonymsAr: ["تعليم", "مدارس", "جامعات", "تدريب"],
    sub: [S("schools", "Private schools", "المدارس الأهلية", "private school"), S("universities", "Universities", "الجامعات", "university"), S("edtech", "Edtech", "التقنية التعليمية", "edtech"), S("training", "Training", "التدريب", "training institute")],
    roles: [R("Chief Executive", "CEO / principal", "المدير العام"), R("Academic", "Academic affairs", "الشؤون الأكاديمية"), R("Procurement", "Procurement", "المشتريات"), R("Chief Information", "IT", "التقنية")],
    signals: [SIG.expansion, SIG.digital, SIG.tender, SIG.hiring],
  },
  {
    id: "Venture Capital & Private Equity", en: "Investors (VC & PE)", ar: "صناديق الاستثمار", synonymsAr: ["استثمار", "صناديق استثمار", "صندوق استثمار", "رأس مال جريء", "مستثمرين", "ملكية خاصة"],
    sub: [S("vc", "Venture capital", "رأس المال الجريء", "venture capital"), S("pe", "Private equity", "الملكية الخاصة", "private equity"), S("cvc", "Corporate VC", "الاستثمار المؤسسي", "corporate venture capital"), S("angels", "Angel networks", "شبكات المستثمرين الملائكيين", "angel investor network")],
    roles: [R("Partner", "Partners", "الشركاء"), R("Principal", "Principals", "مديرو الاستثمار"), R("Investment", "Investment team", "فريق الاستثمار"), R("Platform", "Platform", "المنصة")],
    signals: [SIG.funding, SIG.partnership, SIG.hiring, SIG.leader],
  },
];

export const starterById = (id: string) => DICTIONARY.find((s) => s.id === id);
