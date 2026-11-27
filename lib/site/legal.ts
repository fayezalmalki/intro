import type { LegalDoc } from "@/components/site/Legal";

/**
 * intro.sa's privacy policy and terms. Written to match what the product
 * actually does (lib/, docs/). Review with counsel before relying on them.
 */
const UPDATED = { en: "Last updated 27 November 2026", ar: "آخر تحديث: 27 نوفمبر 2026" };
const CONTACT = { en: "Questions or requests: hello@intro.sa · intro.sa, Riyadh, Saudi Arabia.", ar: "للأسئلة أو الطلبات: hello@intro.sa · انترو، الرياض، المملكة العربية السعودية." };

export const privacy: Record<"en" | "ar", LegalDoc> = {
  en: {
    title: "Privacy policy", updated: UPDATED.en, contact: CONTACT.en,
    intro: "intro.sa helps people find and reach the right professional contacts. This policy explains what we collect, why, how long we keep it, and the choices you have. We follow Saudi Arabia's Personal Data Protection Law (PDPL).",
    sections: [
      { h: "What we collect about you (our users)", p: ["Your email address and sign-in codes; your name, role, company and website; your LinkedIn profile or company website if you ask us to read it during onboarding; your searches, saved leads, notes and conversation stages; your credit purchases (payments are processed by Moyasar — we never see or store card numbers); and basic technical logs needed to run and secure the service."] },
      { h: "What we process about the people you search for", p: ["Professional, publicly available or licensed business information: name, job title, employer, work email (only when you reveal it), public profile links, and public news about their company. We don't collect sensitive personal data. We store the minimum needed to show results and keep your saved leads."] },
      { h: "Why we use it", p: ["To provide the service you ask for (search, saving leads, drafting messages, reminders, sending through intro when you choose it), to bill credits, to prevent abuse and keep our sending reputation healthy, and to improve the product. We don't sell personal data."] },
      { h: "Who we share it with", p: ["Service providers that run intro.sa for us: Cloudflare (hosting, database), ImprovMX (email delivery), Moyasar (payments), and the licensed data providers we query through treg. Each processes data only on our instructions. We disclose data when the law requires it."] },
      { h: "Messages sent through intro", p: ["If you send a message through intro, it goes from \"you via intro\" with replies to your own address and a one-click opt-out. Anyone can opt out at any time; we then never deliver messages through intro to that address. We check every message before it's sent and pause accounts that cause delivery problems."] },
      { h: "How long we keep it", p: ["Account data for as long as your account is open, then deleted within 90 days unless the law requires longer (e.g. payment records). Search results are cached for up to 7 days. Opt-out records are kept as a hashed address so we can honour them."] },
      { h: "Your rights", p: ["You can ask to see, correct or delete your data, or to stop processing, by emailing hello@intro.sa. If you're someone our users found and you don't want to be contacted or listed, email us or use the opt-out link in any message — we'll act on it promptly."] },
      { h: "Security", p: ["Data is encrypted in transit, access is limited to the team that needs it, and sign-in uses one-time codes instead of passwords."] },
    ],
  },
  ar: {
    title: "سياسة الخصوصية", updated: UPDATED.ar, contact: CONTACT.ar,
    intro: "انترو يساعدك تلاقي جهات التواصل المهنية المناسبة وتوصل لها. توضح هذي السياسة وش نجمع، وليش، وكم نحتفظ فيه، وخياراتك. نلتزم بنظام حماية البيانات الشخصية في المملكة العربية السعودية.",
    sections: [
      { h: "وش نجمع عنك (كمستخدم)", p: ["بريدك الإلكتروني ورموز الدخول؛ اسمك ومنصبك وشركتك وموقعها؛ ملفك في لينكدإن أو موقع شركتك إذا طلبت منا نقرأه أثناء التسجيل؛ بحوثك وعملاؤك المحفوظون وملاحظاتك ومراحل تواصلك؛ مشترياتك من الرصيد (الدفع يتم عبر ميسّر ولا نطّلع على بيانات البطاقة ولا نحفظها)؛ وسجلات تقنية أساسية لتشغيل الخدمة وحمايتها."] },
      { h: "وش نعالج عن الأشخاص اللي تبحث عنهم", p: ["معلومات مهنية متاحة للعموم أو من مزوّدي بيانات أعمال مرخّصين: الاسم والمنصب وجهة العمل وبريد العمل (فقط لما تكشفه) وروابط الملفات العامة وأخبار شركاتهم. لا نجمع بيانات حساسة، ونحتفظ بأقل قدر يلزم لعرض النتائج وحفظ عملائك."] },
      { h: "ليش نستخدمها", p: ["لتقديم الخدمة اللي تطلبها (البحث، حفظ العملاء، كتابة الرسائل، التذكيرات، والإرسال عبر انترو إذا اخترته)، ولاحتساب الرصيد، ولمنع إساءة الاستخدام والحفاظ على سمعة الإرسال، ولتحسين المنتج. لا نبيع البيانات الشخصية."] },
      { h: "مع مين نشاركها", p: ["مزوّدو خدمات يشغّلون انترو لصالحنا: كلاودفلير (الاستضافة وقاعدة البيانات)، وImprovMX (توصيل البريد)، وميسّر (المدفوعات)، ومزوّدو البيانات المرخّصون اللي نستعلم منهم عبر treg. كل واحد يعالج البيانات حسب تعليماتنا فقط. ونفصح عنها إذا ألزمنا النظام."] },
      { h: "الرسائل المرسلة عبر انترو", p: ["إذا أرسلت رسالة عبر انترو، تطلع باسمك «عبر انترو» والردود توصل بريدك، وفيها رابط إلغاء اشتراك بضغطة. أي شخص يقدر يلغي في أي وقت، وبعدها ما نوصّل له أي رسالة عبر انترو. نراجع كل رسالة قبل إرسالها، ونوقف الحسابات اللي تسبب مشاكل توصيل."] },
      { h: "كم نحتفظ فيها", p: ["بيانات الحساب طول ما حسابك مفتوح، ثم تُحذف خلال 90 يوم إلا إذا تطلّب النظام مدة أطول (مثل سجلات الدفع). نتائج البحث تُحفظ مؤقتًا حتى 7 أيام. سجلات إلغاء الاشتراك تُحفظ كعنوان مشفّر عشان نلتزم فيها."] },
      { h: "حقوقك", p: ["تقدر تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها أو إيقاف معالجتها عبر hello@intro.sa. وإذا كنت شخصًا وصل له أحد مستخدمينا وما تبي يتواصلون معك أو تظهر في النتائج، راسلنا أو استخدم رابط إلغاء الاشتراك في أي رسالة، ونتصرف بسرعة."] },
      { h: "الأمان", p: ["البيانات مشفّرة أثناء النقل، والوصول مقصور على الفريق اللي يحتاجه، والدخول برموز تُستخدم مرة وحدة بدل كلمات المرور."] },
    ],
  },
};

export const terms: Record<"en" | "ar", LegalDoc> = {
  en: {
    title: "Terms of service", updated: UPDATED.en, contact: CONTACT.en,
    intro: "These terms govern your use of intro.sa. By creating an account you agree to them.",
    sections: [
      { h: "Your account", p: ["Give accurate details about who you are and where you work, keep access to your email secure, and tell us if you think your account was misused. One person per account."] },
      { h: "Acceptable use", p: ["Use intro.sa to reach people for genuine professional reasons: a role, a sale, a partnership, an investment, an introduction. Don't send spam, bulk or deceptive messages, don't harass anyone, don't contact people who opted out, and don't resell or publish the data. Follow the PDPL and the rules that apply to your messages."] },
      { h: "Sending", p: ["You can send from your own email at any time; you're responsible for what you send. Sending through intro requires verification and is limited (daily caps, verified recipients only, an opt-out on every message). We may refuse a message, and pause or end sending through intro on accounts that cause bounces, complaints or abuse."] },
      { h: "Credits and payments", p: ["Credits buy searches, verified emails and sourced goals as priced in the app; empty results are refunded as credits. Prices are in Saudi riyals and payments are processed by Moyasar. Credits are non-transferable and have no cash value; unused credits aren't refundable except where the law requires."] },
      { h: "Data and accuracy", p: ["Results come from licensed and public sources and can be incomplete or out of date. We check emails before showing them but can't guarantee delivery or a reply."] },
      { h: "Ending", p: ["You can close your account any time by emailing us. We may suspend or close accounts that break these terms."] },
      { h: "Liability", p: ["intro.sa is provided as is. To the extent the law allows, we aren't liable for indirect losses, and our total liability is limited to what you paid us in the 3 months before the claim."] },
      { h: "Law", p: ["These terms are governed by the laws of the Kingdom of Saudi Arabia, and disputes go to the competent courts in Riyadh."] },
    ],
  },
  ar: {
    title: "شروط الاستخدام", updated: UPDATED.ar, contact: CONTACT.ar,
    intro: "تحكم هذي الشروط استخدامك لانترو. بإنشاء حساب توافق عليها.",
    sections: [
      { h: "حسابك", p: ["قدّم معلومات صحيحة عن هويتك وجهة عملك، وحافظ على أمان بريدك، وبلّغنا إذا شككت إن حسابك أُسيء استخدامه. حساب واحد لكل شخص."] },
      { h: "الاستخدام المقبول", p: ["استخدم انترو للتواصل مع الناس لأسباب مهنية حقيقية: وظيفة، بيع، شراكة، استثمار، أو تعارف. لا ترسل رسائل مزعجة أو جماعية أو مضللة، ولا تضايق أحد، ولا تتواصل مع من ألغى اشتراكه، ولا تعيد بيع البيانات أو تنشرها. التزم بنظام حماية البيانات الشخصية والأنظمة المطبقة على رسائلك."] },
      { h: "الإرسال", p: ["تقدر ترسل من بريدك في أي وقت، وأنت مسؤول عن اللي ترسله. الإرسال عبر انترو يتطلب التوثيق وله حدود (حد يومي، بريد موثّق فقط، ورابط إلغاء اشتراك في كل رسالة). يحق لنا رفض أي رسالة، وإيقاف أو إنهاء الإرسال عبر انترو للحسابات اللي تسبب ارتدادات أو شكاوى أو إساءة."] },
      { h: "الرصيد والمدفوعات", p: ["الرصيد يُستخدم للبحث والبريد الموثّق والأهداف حسب الأسعار في التطبيق، والنتائج الفاضية يرجع رصيدها. الأسعار بالريال السعودي والدفع عبر ميسّر. الرصيد غير قابل للتحويل وليس له قيمة نقدية، والرصيد غير المستخدم غير قابل للاسترداد إلا حيث يلزم النظام."] },
      { h: "البيانات ودقتها", p: ["النتائج من مصادر مرخّصة وعامة وقد تكون ناقصة أو قديمة. نتحقق من البريد قبل عرضه، لكن ما نضمن التوصيل أو الرد."] },
      { h: "إنهاء الحساب", p: ["تقدر تغلق حسابك في أي وقت بمراسلتنا. ويحق لنا تعليق أو إغلاق الحسابات المخالفة لهذي الشروط."] },
      { h: "المسؤولية", p: ["تُقدَّم الخدمة كما هي. وبالقدر اللي يسمح فيه النظام، لا نتحمل الخسائر غير المباشرة، ومسؤوليتنا الإجمالية محدودة بما دفعته لنا خلال الثلاثة أشهر السابقة للمطالبة."] },
      { h: "النظام المطبق", p: ["تخضع هذي الشروط لأنظمة المملكة العربية السعودية، وتختص محاكم الرياض بأي نزاع."] },
    ],
  },
};
