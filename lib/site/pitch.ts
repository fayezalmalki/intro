import type { IconKey } from "@/components/site/ui";
import type { Locale } from "./types";

/**
 * The landing's words, both languages. Each language is written for its own
 * reader (Arabic is not a translation of the English). Every claim here is
 * something the product does today: if a feature ships later, so does its line.
 */

export type SearchTab = { mode: "companies" | "people" | "person"; label: string; placeholder: string };

export interface Pitch {
  locale: Locale;
  dir: "ltr" | "rtl";
  meta: { title: string; description: string };
  skip: string;
  nav: { how: string; uses: string; pricing: string; faq: string; signIn: string; myAccount: string; cta: string; other: { label: string; href: string } };
  hero: { pill: string; headline: [string, string]; sub: string; proof: { icon: IconKey; label: string }[] };
  search: { label: string; tabs: SearchTab[]; market: string; submit: string; note: string };
  preview: { label: string; name: string; role: string; company: string; why: string; source: string; email: string; verified: string; save: string; draft: string };
  how: { eyebrow: string; heading: string; steps: { icon: IconKey; title: string; body: string }[] };
  uses: { eyebrow: string; heading: string; items: { icon: IconKey; title: string; body: string; example: string; mode: SearchTab["mode"] | "request" }[]; tryIt: string };
  features: { eyebrow: string; heading: string; items: { icon: IconKey; title: string; body: string }[] };
  pricing: { eyebrow: string; heading: string; body: string; costs: { label: string; value: string }[]; packs: string; perCredits: (n: number) => string; currency: string; popular: string; cta: string; note: string };
  faq: { eyebrow: string; heading: string; items: { q: string; a: string }[] };
  close: { heading: string; body: string };
  footer: { tagline: string; rights: string };
}

export const pitchEn: Pitch = {
  locale: "en",
  dir: "ltr",
  meta: {
    title: "intro.sa — The right people, and a reason to reach them",
    description: "Find the hiring manager, the customer or the one person you need in Saudi Arabia and the Gulf — with a dated reason to reach out now and a verified email.",
  },
  skip: "Skip to content",
  nav: { how: "How it works", uses: "Use cases", pricing: "Pricing", faq: "FAQ", signIn: "Sign in", myAccount: "Open the app", cta: "Start free", other: { label: "العربية", href: "/ar" } },
  hero: {
    pill: "Built for Saudi Arabia and the Gulf",
    headline: ["The right people.", "A reason to reach them."],
    sub: "Tell intro.sa what you're after — a new role, new customers, or one hard-to-find person. We show you who to talk to, why now, and how to reach them.",
    proof: [
      { icon: "file-text", label: "A dated source behind every name" },
      { icon: "check-circle", label: "Verified emails only" },
      { icon: "shield-check", label: "Nothing is sent without you" },
    ],
  },
  search: {
    label: "What are you looking for?",
    tabs: [
      { mode: "companies", label: "Customers", placeholder: "e.g. insurers investing in digital claims" },
      { mode: "people", label: "A job", placeholder: "e.g. hiring managers for product roles at fintechs" },
      { mode: "person", label: "Someone specific", placeholder: "e.g. Head of Procurement at Almarai" },
    ],
    market: "Market",
    submit: "Search free",
    note: "Create your free account with just your email — your search runs the moment you're in. 20 credits on us.",
  },
  preview: {
    label: "What a result looks like",
    name: "Faisal Alotaibi",
    role: "Chief Claims Officer",
    company: "Qimma Insurance · Riyadh",
    why: "Hiring three claims handlers this month — the team is stretched.",
    source: "Company job posts · 18 Nov",
    email: "faisal@qimma-insurance.sa",
    verified: "Verified",
    save: "Save",
    draft: "Draft a message",
  },
  how: {
    eyebrow: "How it works",
    heading: "From one sentence to the person who can say yes",
    steps: [
      { icon: "search", title: "Say what you need", body: "One line, in English or Arabic. Pick the market — Saudi Arabia or anywhere in the Gulf." },
      { icon: "target", title: "See who matters, and why now", body: "Companies and people with a dated reason to talk: a new hire, an open role, a funding round, a news story." },
      { icon: "send", title: "Reach out your way", body: "Save them, reveal a verified email, and get a first message drafted. Or simply keep the list." },
    ],
  },
  uses: {
    eyebrow: "Use cases",
    heading: "Three jobs intro.sa does well",
    tryIt: "Try it",
    items: [
      { icon: "briefcase", title: "Get hired", body: "Skip the application pile. Find the hiring manager behind the role and write to them directly.", example: "Hiring managers for product roles in Riyadh", mode: "people" },
      { icon: "trend", title: "Win customers", body: "Find the companies that need what you sell right now — and the person who makes the call.", example: "Insurers investing in digital claims", mode: "companies" },
      { icon: "user-search", title: "Find someone important", body: "A decision maker, a supplier, an investor or a partner — with the context to open the conversation.", example: "Head of Procurement at Almarai", mode: "person" },
      { icon: "sparkles", title: "Anything else", body: "Describe what you need in a sentence. We turn it into a brief, find the people, and draft the first message.", example: "Introduce our payroll app to HR leaders at Saudi retailers", mode: "request" },
    ],
  },
  features: {
    eyebrow: "What you get",
    heading: "Everything you need to open the conversation",
    items: [
      { icon: "search", title: "Four ways to search", body: "Companies, people by role, one specific person, or the news about a company." },
      { icon: "file-text", title: "Why now, with a source", body: "Every reason links to where it came from and when. No source, no claim." },
      { icon: "at-sign", title: "Verified emails", body: "We check each address before you see it. Not found? The credit comes back." },
      { icon: "users", title: "Your leads in one place", body: "Save the people worth a conversation and pick them up later, on any device." },
      { icon: "send", title: "A first message, drafted", body: "Built from who they are and why now — you edit it, you decide if it goes." },
      { icon: "refresh", title: "Fair credits", body: "Repeating your own search within 3 days is free, and empty results are refunded." },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    heading: "Start with 20 free credits",
    body: "Pay only for what you use. No subscription.",
    costs: [
      { label: "A search", value: "1 credit" },
      { label: "A verified email", value: "1 credit" },
      { label: "A full goal, sourced for you", value: "5 credits" },
    ],
    packs: "Top up when you need more",
    perCredits: (n) => `${n.toLocaleString("en")} credits`,
    currency: "SAR",
    popular: "Most popular",
    cta: "Start free",
    note: "Prices in Saudi riyals. Pay with mada, Visa, Mastercard or Apple Pay.",
  },
  faq: {
    eyebrow: "FAQ",
    heading: "Questions people ask first",
    items: [
      { q: "Do I need an account to search?", a: "Yes — a free one, with just your email and a one-time code. It keeps your searches and leads together, and your first search runs as soon as you're in." },
      { q: "Where does the data come from?", a: "Licensed business-data providers and public sources such as company websites, job posts and the news. Every reason we show carries its source and date." },
      { q: "Will you email people for me?", a: "Only if you ask, and only messages you approve. By default nothing is sent — many people just keep the list." },
      { q: "What does a credit buy?", a: "One search or one verified email. If a search finds nothing or an email can't be verified, the credit comes back." },
      { q: "Which markets do you cover?", a: "Saudi Arabia first, plus the UAE, Qatar, Kuwait, Bahrain, Oman, Egypt and Jordan." },
    ],
  },
  close: { heading: "Who do you need to reach?", body: "Type it in. Your account takes a minute, and the search runs right after." },
  footer: { tagline: "The right people, and a reason to reach them.", rights: "© 2026 intro.sa" },
};

export const pitchAr: Pitch = {
  locale: "ar",
  dir: "rtl",
  meta: {
    title: "انترو — الشخص الصح، وسبب تتواصل معه",
    description: "اوصل لمسؤول التوظيف أو العميل أو الشخص اللي تحتاجه في السعودية والخليج، مع سبب واضح ومؤرّخ للتواصل الحين، وبريد موثّق.",
  },
  skip: "انتقل للمحتوى",
  nav: { how: "كيف يشتغل", uses: "الاستخدامات", pricing: "الأسعار", faq: "الأسئلة", signIn: "دخول", myAccount: "افتح التطبيق", cta: "ابدأ مجانًا", other: { label: "English", href: "/" } },
  hero: {
    pill: "مصمّم للسعودية والخليج",
    headline: ["الشخص الصح،", "وسبب تتواصل معه."],
    sub: "قل لانترو وش تدوّر عليه: وظيفة جديدة، عملاء جدد، أو شخص صعب توصله. نوريك مين تكلّم، وليش الحين، وكيف توصله.",
    proof: [
      { icon: "file-text", label: "مصدر وتاريخ وراء كل اسم" },
      { icon: "check-circle", label: "بريد موثّق فقط" },
      { icon: "shield-check", label: "ما يُرسل شي بدون موافقتك" },
    ],
  },
  search: {
    label: "وش تدوّر عليه؟",
    tabs: [
      { mode: "companies", label: "عملاء", placeholder: "مثال: شركات تأمين تستثمر في المطالبات الرقمية" },
      { mode: "people", label: "وظيفة", placeholder: "مثال: مسؤولو التوظيف لوظائف المنتج في التقنية المالية" },
      { mode: "person", label: "شخص محدد", placeholder: "مثال: مدير المشتريات في المراعي" },
    ],
    market: "السوق",
    submit: "ابحث مجانًا",
    note: "سجّل ببريدك فقط، وبحثك يشتغل أول ما تدخل. معك 20 رصيد هدية.",
  },
  preview: {
    label: "شكل النتيجة",
    name: "فيصل العتيبي",
    role: "رئيس المطالبات",
    company: "قمة للتأمين · الرياض",
    why: "يوظّفون ثلاثة في المطالبات هالشهر، والفريق مضغوط.",
    source: "إعلانات وظائف الشركة · 18 نوفمبر",
    email: "faisal@qimma-insurance.sa",
    verified: "موثّق",
    save: "احفظ",
    draft: "اكتب رسالة",
  },
  how: {
    eyebrow: "كيف يشتغل",
    heading: "من جملة وحدة إلى الشخص اللي بيده القرار",
    steps: [
      { icon: "search", title: "قل وش تحتاج", body: "سطر واحد بالعربي أو الإنجليزي، واختر السوق: السعودية أو أي دولة خليجية." },
      { icon: "target", title: "شوف مين يهمك وليش الحين", body: "شركات وأشخاص بسبب واضح ومؤرّخ: تعيين جديد، وظيفة مفتوحة، جولة تمويل، أو خبر." },
      { icon: "send", title: "تواصل بطريقتك", body: "احفظهم، اكشف البريد الموثّق، وخذ أول رسالة جاهزة. أو احتفظ بالقائمة لنفسك." },
    ],
  },
  uses: {
    eyebrow: "الاستخدامات",
    heading: "ثلاث مهام يتقنها انترو",
    tryIt: "جرّبها",
    items: [
      { icon: "briefcase", title: "توصل لوظيفتك", body: "بدل ما تضيع بين مئات المتقدمين، اعرف مسؤول التوظيف وكلّمه مباشرة.", example: "مسؤولو التوظيف لوظائف المنتج في الرياض", mode: "people" },
      { icon: "trend", title: "اكسب عملاء", body: "اعرف الشركات اللي تحتاج اللي تبيعه الحين، ومين صاحب القرار فيها.", example: "شركات تأمين تستثمر في المطالبات الرقمية", mode: "companies" },
      { icon: "user-search", title: "لاقِ الشخص المهم", body: "صاحب قرار، مورّد، مستثمر أو شريك، مع سياق يفتح لك الكلام.", example: "مدير المشتريات في المراعي", mode: "person" },
      { icon: "sparkles", title: "أي شي ثاني", body: "اكتب اللي تحتاجه في جملة، ونحوّله لخطة، ونلقى لك الناس، ونكتب أول رسالة.", example: "أعرّف بتطبيق الرواتب لمدراء الموارد البشرية في شركات التجزئة", mode: "request" },
    ],
  },
  features: {
    eyebrow: "وش تحصل",
    heading: "كل اللي تحتاجه عشان تفتح الكلام",
    items: [
      { icon: "search", title: "أربع طرق للبحث", body: "شركات، أشخاص حسب الدور، شخص بعينه، أو أخبار شركة." },
      { icon: "file-text", title: "ليش الحين، بمصدر", body: "كل سبب مربوط بمصدره وتاريخه. بدون مصدر، ما نقول شي." },
      { icon: "at-sign", title: "بريد موثّق", body: "نتحقق من كل عنوان قبل ما تشوفه. ما لقيناه؟ يرجع لك الرصيد." },
      { icon: "users", title: "عملاؤك في مكان واحد", body: "احفظ اللي يستاهلون التواصل وكمّل معهم بعدين من أي جهاز." },
      { icon: "send", title: "أول رسالة جاهزة", body: "مبنية على مين هم وليش الحين. تعدّلها، وأنت اللي تقرر ترسلها." },
      { icon: "refresh", title: "رصيد منصف", body: "تكرار بحثك خلال 3 أيام مجاني، والنتائج الفاضية يرجع رصيدها." },
    ],
  },
  pricing: {
    eyebrow: "الأسعار",
    heading: "ابدأ بـ 20 رصيد مجاني",
    body: "تدفع على قد استخدامك، بدون اشتراك.",
    costs: [
      { label: "بحث", value: "1 رصيد" },
      { label: "بريد موثّق", value: "1 رصيد" },
      { label: "هدف كامل نجهزه لك", value: "5 رصيد" },
    ],
    packs: "اشحن لما تحتاج أكثر",
    perCredits: (n) => `${n.toLocaleString("en")} رصيد`,
    currency: "ر.س",
    popular: "الأكثر طلبًا",
    cta: "ابدأ مجانًا",
    note: "الأسعار بالريال السعودي. ادفع بمدى أو فيزا أو ماستركارد أو Apple Pay.",
  },
  faq: {
    eyebrow: "الأسئلة",
    heading: "أول أسئلة الناس",
    items: [
      { q: "أحتاج حساب عشان أبحث؟", a: "إيه، حساب مجاني ببريدك ورمز يوصلك. يحفظ بحوثك وعملاءك مع بعض، وأول بحث يشتغل أول ما تدخل." },
      { q: "من وين البيانات؟", a: "من مزوّدي بيانات أعمال مرخّصين ومصادر عامة مثل مواقع الشركات وإعلانات الوظائف والأخبار. وكل سبب نعرضه معه مصدره وتاريخه." },
      { q: "بترسلون إيميلات بالنيابة عني؟", a: "فقط إذا طلبت، وفقط الرسائل اللي توافق عليها. افتراضيًا ما يُرسل شي، وكثير يكتفون بالقائمة." },
      { q: "وش يشتري الرصيد؟", a: "بحث واحد أو بريد موثّق واحد. إذا البحث ما لقى شي أو البريد ما تأكد، يرجع لك الرصيد." },
      { q: "وش الأسواق اللي تغطونها؟", a: "السعودية أولًا، ومعها الإمارات وقطر والكويت والبحرين وعُمان ومصر والأردن." },
    ],
  },
  close: { heading: "مين تحتاج توصله؟", body: "اكتبه هنا. حسابك ياخذ دقيقة، والبحث يشتغل بعدها مباشرة." },
  footer: { tagline: "الشخص الصح، وسبب تتواصل معه.", rights: "© 2026 انترو" },
};
