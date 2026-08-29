import type { DraftLang, DraftSpecific, DraftTemplate } from "../types";

/**
 * The intro composer — the product, really.
 *
 * A generic Arabic template with a name slotted into it is a failure. Every
 * draft this file produces has to carry something specific and *true* about the
 * recipient, and where there is nothing specific it says less rather than
 * inventing. That rule is not advisory: `specifics` is returned alongside the
 * body and holds the field each concrete claim came from, so the review screen
 * can show the reader exactly which sentences are load-bearing and where they
 * were sourced. An empty `specifics` array changes the letter — it does not
 * mean the letter went out anyway with confident-sounding filler.
 *
 * Arabic is written first, not translated. The English variant exists because
 * some recipients in Riyadh work in English all day; it is a rewrite in the
 * same register, not a gloss of the Arabic. Anyone comparing the two will find
 * the Arabic reads like a Saudi business email and the English reads like an
 * English one — neither reads like the other's shadow.
 *
 * The greeting is «السلام عليكم أ. {الاسم}». «أ.» is the ordinary Saudi
 * abbreviation for أستاذ/أستاذة and carries no gender, which matters when the
 * only thing the vendor gave us is a name string.
 *
 * Length is capped by construction: docs/03-design-review.md §4 puts a ~120
 * word ceiling on a first touch, no attachments and no links in the body. The
 * sender's own site appears in the signature, where a recipient expects it.
 */

export interface Sender {
  /** The user's company, from the analysed site profile. */
  company: string;
  /** One line, in Arabic: what they sell and to whom. */
  sells: string;
  /**
   * The same line in English, when the analysis produced one.
   *
   * Not a nicety. Without it the "English variant" is an English frame with
   * Arabic sentences inside it — worse than no English at all, because it looks
   * finished. When this is empty the composer falls back to the Arabic and
   * reports `englishComplete: false`, and the toggle says so rather than
   * pretending.
   */
  sellsEn?: string;
  /** The human writing. First person is the whole register — Boardy's lesson. */
  person: string;
  website?: string;
  market?: string;
}

export interface Recipient {
  fullName: string;
  firstName?: string;
  title?: string;
  companyName?: string;
  /**
   * Only when the two differ. Vendor titles arrive in English and read
   * perfectly well inside an Arabic sentence — «مدير Business Development في
   * س» is how people actually write — so these stay undefined for real rows
   * and exist for the hand-written examples, which are Arabic on both sides.
   */
  titleEn?: string;
  companyNameEn?: string;
  industry?: string;
  employeesCount?: number | null;
  hqCountry?: string;
}

export interface SegmentContext {
  name: string;
  nameEn?: string;
  pain: string;
  painEn?: string;
  criteria?: string[];
}

export interface ComposeInput {
  sender: Sender;
  recipient: Recipient;
  segment: SegmentContext;
  template: DraftTemplate;
}

export interface ComposedDraft {
  subjectAr: string;
  bodyAr: string;
  subjectEn: string;
  bodyEn: string;
  /** Every concrete claim, paired with the field it came from. */
  specifics: DraftSpecific[];
  /** True when we had nothing beyond a name, and the letter says so. */
  thin: boolean;
  /**
   * Whether every English input was actually available.
   *
   * False means the English body borrowed an Arabic sentence, and the language
   * toggle warns instead of presenting it as a finished English letter.
   */
  englishComplete: boolean;
}

export interface TemplateMeta {
  id: DraftTemplate;
  labelAr: string;
  labelEn: string;
  /** What this opener asks for, in one line — shown in the picker. */
  askAr: string;
}

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: "direct",
    labelAr: "فتح مباشر",
    labelEn: "Direct opener",
    askAr: "يشرح السبب ويطلب عشر دقائق.",
  },
  {
    id: "warm_intro",
    labelAr: "طلب تعارف",
    labelEn: "Warm intro request",
    askAr: "ما يبيع شيء — يطلب توجيه لأصحّ شخص.",
  },
  {
    id: "partnership",
    labelAr: "طرح شراكة",
    labelEn: "Partnership approach",
    askAr: "يطرح شكلًا تجاريًا مشتركًا، لا صفقة بيع.",
  },
];

export const TEMPLATE_IDS: readonly DraftTemplate[] = TEMPLATES.map((t) => t.id);

export function isTemplate(value: string): value is DraftTemplate {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * The first name to address someone by.
 *
 * Coresignal hands back a single `full_name` more often than not, and Arabic
 * names arrive both transliterated and in Arabic script. Taking the first token
 * is right in both scripts; anything cleverer would be guessing at a person's
 * name, which is the worst possible place to guess.
 */
export function firstNameOf(recipient: Recipient): string {
  const explicit = recipient.firstName?.trim();
  if (explicit) return explicit;
  return recipient.fullName.trim().split(/\s+/)[0] ?? recipient.fullName.trim();
}

/**
 * The true things we may say about this person, each tagged with its source.
 *
 * Nothing derived, nothing inferred, nothing rounded into a claim. A company
 * with no `employeesCount` produces no size sentence; it does not produce
 * "a growing team". This function is the only place a draft's factual content
 * comes from, so a fact that is not here cannot reach the letter.
 */
export function specificsFor(recipient: Recipient): DraftSpecific[] {
  const out: DraftSpecific[] = [];
  const company = recipient.companyName?.trim();
  const title = recipient.title?.trim();

  if (title && company) {
    out.push({ text: `${title} في ${company}`, field: "title+company" });
  } else if (title) {
    out.push({ text: title, field: "title" });
  } else if (company) {
    out.push({ text: company, field: "company" });
  }

  if (recipient.industry?.trim()) {
    out.push({ text: recipient.industry.trim(), field: "industry" });
  }

  // A size sentence needs a number the vendor actually returned. "about N" is
  // honest about the precision; "a growing team" would be a claim we cannot
  // support from a headcount field.
  if (typeof recipient.employeesCount === "number" && recipient.employeesCount > 0) {
    out.push({
      text: `حجم الفريق قريب من ${recipient.employeesCount}`,
      field: "employees_count",
    });
  }

  return out;
}

/**
 * Whether we know anything about the recipient beyond their name.
 *
 * A title alone is enough to write a specific letter. Nothing at all is not,
 * and that case takes a different letter rather than the same one with the
 * blanks quietly closed up.
 */
export function isThin(recipient: Recipient): boolean {
  return specificsFor(recipient).length === 0;
}

function sizeClauseAr(recipient: Recipient): string {
  const n = recipient.employeesCount;
  if (typeof n !== "number" || n <= 0) return "";
  return ` وحجم الفريق عندكم قريب من ${n}`;
}

function sizeClauseEn(recipient: Recipient): string {
  const n = recipient.employeesCount;
  if (typeof n !== "number" || n <= 0) return "";
  return ` and the team is around ${n} people`;
}

/**
 * «لأنك مديرة المبيعات في س» — the title carries the gender, so the clause
 * never has to. An earlier draft said «تشغل دور {title}», which forces a
 * masculine verb in front of a feminine title; the vendor gives us a name
 * string and nothing else, so a construction that has to guess is a
 * construction that will be wrong for half the recipients.
 */
function roleClauseAr(recipient: Recipient): string {
  const title = recipient.title?.trim();
  const company = recipient.companyName?.trim();
  if (title && company) return `${title} في ${company}`;
  if (title) return title;
  if (company) return `في ${company}`;
  return "";
}

function roleClauseEn(recipient: Recipient): string {
  const title = (recipient.titleEn ?? recipient.title)?.trim();
  const company = (recipient.companyNameEn ?? recipient.companyName)?.trim();
  if (title && company) return `you run ${title} at ${company}`;
  if (title) return `you run ${title}`;
  if (company) return `you are at ${company}`;
  return "";
}

function signatureAr(sender: Sender): string {
  const site = sender.website?.trim();
  return site ? `${sender.person}\n${sender.company} — ${site}` : `${sender.person}\n${sender.company}`;
}

function signatureEn(sender: Sender): string {
  const site = sender.website?.trim();
  return site ? `${sender.person}\n${sender.company} — ${site}` : `${sender.person}\n${sender.company}`;
}

/** A sentence always ends once. The vendor's strings do not agree about that. */
function sentence(text: string): string {
  const trimmed = text.trim().replace(/[.。،]+$/u, "");
  return trimmed ? `${trimmed}.` : "";
}

/**
 * The same, capitalised.
 *
 * The analysis returns fragments — "we help Saudi teams reach…" — that are
 * written to sit mid-sentence. Dropped into an English paragraph as-is they
 * start a sentence in lower case, which is the single fastest way to make a
 * letter look machine-assembled. Arabic has no case, so this is an English-only
 * concern and lives in an English-only helper.
 */
function sentenceEn(text: string): string {
  const s = sentence(text);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function joinParagraphs(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

/** Words, for the ~120-word first-touch ceiling. */
export function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function compose(input: ComposeInput): ComposedDraft {
  const { sender, recipient, segment } = input;
  const first = firstNameOf(recipient);
  const specifics = specificsFor(recipient);
  const thin = specifics.length === 0;
  const company = recipient.companyName?.trim() || "";

  const ar = composeAr(input, { first, thin, company });
  const en = composeEn(input, { first, thin, company });

  // Every English sentence had an English source. `sells` always matters;
  // the pain line only matters when there is a pain line to say.
  const englishComplete =
    Boolean(sender.sellsEn?.trim()) &&
    (!segment.pain.trim() || Boolean(segment.painEn?.trim()));

  return {
    subjectAr: ar.subject,
    bodyAr: ar.body,
    subjectEn: en.subject,
    bodyEn: en.body,
    specifics,
    thin,
    englishComplete,
  };
}

interface Ctx {
  first: string;
  thin: boolean;
  company: string;
}

function composeAr(input: ComposeInput, ctx: Ctx): { subject: string; body: string } {
  const { sender, recipient, segment, template } = input;
  const greeting = `السلام عليكم أ. ${ctx.first}،`;
  const intro = `أنا ${sender.person} من ${sender.company}. ${sentence(sender.sells)}`;
  const sign = signatureAr(sender);
  const role = roleClauseAr(recipient);
  const size = sizeClauseAr(recipient);

  /**
   * The one sentence that separates a real letter from a mail merge — and the
   * one that must never be written when there is nothing to put in it. On the
   * thin path it is replaced by an admission, not by a vaguer version of
   * itself.
   */
  const because = ctx.thin
    ? `وصلت لك من بحث على «${segment.name}» في السوق السعودي، وما عندي تفاصيل كافية عن دورك الحالي — فسامحني إذا كان الموضوع بعيد عنك.`
    : `وصلت لك تحديدًا لأنك ${role}${size}.`;

  const pain = sentence(segment.pain);

  if (template === "warm_intro") {
    const subject = ctx.company
      ? `سؤال قصير — ${ctx.company}`
      : `سؤال قصير من ${sender.company}`;
    const body = joinParagraphs([
      greeting,
      intro,
      `${because} ${pain}`,
      "ما أبي أبيعك شيء في هذي الرسالة. أبي سطر واحد منك: إما توجهني للشخص الصح عندكم، أو تقول لي إن الموضوع ما يناسبكم وأغلقه من طرفي.",
      sign,
    ]);
    return { subject, body };
  }

  if (template === "partnership") {
    const subject = ctx.company
      ? `شراكة محتملة بين ${sender.company} و${ctx.company}`
      : `شراكة محتملة مع ${sender.company}`;
    const body = joinParagraphs([
      greeting,
      intro,
      `${because} ${pain}`,
      `أطرح عليك شكلًا مشتركًا بدل صفقة بيع: نجرب حالة واحدة محددة عندكم، ونقيس أثرها قبل أي التزام تجاري.`,
      "إذا فيه اهتمام مبدئي، أرسل لي وقتًا وأجهز لك صفحة وحدة توضح الشكل والتكلفة.",
      sign,
    ]);
    return { subject, body };
  }

  const subject = ctx.company
    ? `${sender.company} و${ctx.company} — عشر دقائق؟`
    : `${sender.company} — عشر دقائق؟`;
  const body = joinParagraphs([
    greeting,
    intro,
    `${because} ${pain}`,
    "إذا كان هذا قريب من أولوياتكم، أعطني عشر دقائق هذا الأسبوع وأوريك بالضبط كيف. وإذا ما كان الوقت مناسب، قل لي وما راح أزعجك مرة ثانية.",
    sign,
  ]);
  return { subject, body };
}

function composeEn(input: ComposeInput, ctx: Ctx): { subject: string; body: string } {
  const { sender, recipient, segment, template } = input;
  const greeting = `Hi ${ctx.first},`;
  // Falls back to the Arabic when no English line was captured. The fallback is
  // reported as `englishComplete: false` rather than hidden, because a
  // half-English letter that looks finished is the failure mode worth catching.
  const sells = sender.sellsEn?.trim() || sender.sells;
  const segmentName = segment.nameEn?.trim() || segment.name;
  const pain = sentenceEn(segment.painEn?.trim() || segment.pain);
  const intro = `I'm ${sender.person} from ${sender.company}. ${sentenceEn(sells)}`;
  const sign = signatureEn(sender);
  const role = roleClauseEn(recipient);
  const size = sizeClauseEn(recipient);
  const company = (recipient.companyNameEn ?? recipient.companyName)?.trim() ?? "";

  const because = ctx.thin
    ? `I found you while looking at "${segmentName}" in the Saudi market, and I don't have enough detail on your current remit — so apologies if this is off the mark.`
    : `I'm writing to you specifically because ${role}${size}.`;

  if (template === "warm_intro") {
    const subject = company ? `Quick question — ${company}` : `Quick question from ${sender.company}`;
    const body = joinParagraphs([
      greeting,
      intro,
      `${because} ${pain}`,
      "I'm not selling anything in this email. One line back is all I need: either point me at the right person on your side, or tell me it isn't relevant and I'll close it from mine.",
      sign,
    ]);
    return { subject, body };
  }

  if (template === "partnership") {
    const subject = company
      ? `A possible partnership: ${sender.company} and ${company}`
      : `A possible partnership with ${sender.company}`;
    const body = joinParagraphs([
      greeting,
      intro,
      `${because} ${pain}`,
      "Rather than a sale, I'd suggest a shared shape: we try one specific case on your side and measure it before any commercial commitment.",
      "If there's initial interest, send me a time and I'll bring a single page on the shape and the cost.",
      sign,
    ]);
    return { subject, body };
  }

  const subject = company
    ? `${sender.company} and ${company} — ten minutes?`
    : `${sender.company} — ten minutes?`;
  const body = joinParagraphs([
    greeting,
    intro,
    `${because} ${pain}`,
    "If that's close to your priorities, give me ten minutes this week and I'll show you exactly how. If the timing is wrong, say so and I won't chase.",
    sign,
  ]);
  return { subject, body };
}

/** The body in the language the draft is set to. */
export function bodyFor(
  draft: Pick<ComposedDraft, "bodyAr" | "bodyEn">,
  lang: DraftLang,
): string {
  return lang === "en" ? draft.bodyEn : draft.bodyAr;
}
