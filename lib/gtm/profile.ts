import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExampleCompany, ProfileSource } from "../types";

/**
 * Step 1 and 2 of the run: read the user's own website, and say what the
 * company does.
 *
 * Everything downstream hangs off this — the segments, the search queries, the
 * first paragraph of every draft — so the failure modes get as much room here
 * as the happy path. Three things can go wrong and each has a different
 * remedy, which is why they are three different messages rather than one
 * "analysis failed":
 *
 *   • the URL does not resolve, or the site refuses us  → the user retypes it
 *   • the page is a JavaScript shell with no readable text → the user types the
 *     one line themselves
 *   • there is no ANTHROPIC_API_KEY → we fall back to the page's own <title>
 *     and meta description, which is thin but true, and the screen says which
 *
 * None of the three is a dead end, and none of them is a spinner. The step
 * carries its own error string into `gtm_runs.steps` and the rail renders it.
 */

export interface AnalyzedProfile {
  name: string;
  /** One line, Arabic: what they sell and to whom. */
  sells: string;
  sellsEn: string;
  market: string;
  sizeSignal: string;
  language: string;
  offerings: string[];
  /**
   * Named by the analysis, never by a data vendor — so they are labelled
   * `analysis` and the UI shows them as unverified suggestions. A competitor
   * list is a claim about real companies; presenting a model's guess as a
   * lookup would be the same dishonesty as an unsourced count.
   */
  competitors: ExampleCompany[];
  source: ProfileSource;
  sourceExcerpt: string;
}

export interface SiteText {
  url: string;
  title: string;
  description: string;
  /** Visible text, collapsed and trimmed. Enough to read, not enough to store. */
  text: string;
}

export class SiteFetchError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "SiteFetchError";
  }
}

/** How much of a page we are willing to read into a prompt. */
const MAX_TEXT = 6_000;
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Accepts what people actually type.
 *
 * "intro.sa", "www.intro.sa", "https://intro.sa/pricing" all name the same
 * company, and a form that rejects the first two is a form that loses users at
 * the first field. Anything that is not a plausible host is refused here rather
 * than turned into a fetch that fails confusingly later.
 */
export function normalizeWebsite(input: string): string {
  const raw = input.trim();
  if (!raw) throw new SiteFetchError("اكتب رابط موقعك.");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new SiteFetchError("هذا ما يشبه رابط موقع. جرّب مثل: example.com");
  }
  if (!url.hostname.includes(".") || /\s/.test(url.hostname)) {
    throw new SiteFetchError("هذا ما يشبه رابط موقع. جرّب مثل: example.com");
  }
  return url.toString();
}

/** The bare host, for display and for the vendor's website-keyed lookups. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  return (html.match(pattern)?.[1] ?? html.match(alt)?.[1] ?? "").trim();
}

/**
 * Fetches the page and reduces it to text.
 *
 * `AbortSignal.timeout` rather than a bare fetch: a site that accepts the
 * connection and never answers would otherwise hang the whole run behind a
 * step that looks like it is still working.
 */
export async function fetchSite(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SiteText> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "intro.sa site analysis (+https://intro.sa)" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name + error.message);
    throw new SiteFetchError(
      timedOut
        ? "الموقع ما رد خلال ١٢ ثانية. تأكد من الرابط أو اكتب الوصف يدويًا."
        : "ما قدرنا نوصل للموقع. تأكد من الرابط أو اكتب الوصف يدويًا.",
    );
  }

  if (!response.ok) {
    throw new SiteFetchError(
      `الموقع رد بالرمز ${response.status}. تأكد من الرابط أو اكتب الوصف يدويًا.`,
    );
  }

  const html = await response.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description = metaContent(html, "description") || metaContent(html, "og:description");
  const text = stripTags(html).slice(0, MAX_TEXT);

  if (!title && !description && text.length < 60) {
    throw new SiteFetchError(
      "الصفحة ما فيها نص نقدر نقرأه — غالبًا تُبنى بالكامل في المتصفح. اكتب سطرًا واحدًا عن شركتك وبنكمل.",
    );
  }

  return { url, title, description, text };
}

const ProfileSchema = z.object({
  name: z.string(),
  sells: z.string(),
  sellsEn: z.string(),
  market: z.string(),
  sizeSignal: z.string(),
  language: z.string(),
  offerings: z.array(z.string()),
  competitors: z.array(z.object({ name: z.string(), website: z.string() })),
});

const SYSTEM = `أنت محلل شركات في منصة Intro السعودية.
تُعطى نص صفحة رئيسية لشركة، وتستخرج منها ملفًا موجزًا.

قواعد صارمة:
- لا تخترع شيئًا. كل ما تكتبه لازم يكون مستنتَجًا من نص الصفحة نفسها.
- sells: سطر واحد بالعربي السعودي المهني يبدأ بفعل، يوصف ما الذي تبيعه الشركة ولمن.
  يُستخدم داخل جملة، فلا تبدأه بحرف كبير ولا تنهه بنقطة.
- sellsEn: نفس السطر بالإنجليزية، مكتوب كإنجليزية أصلية لا كترجمة حرفية.
- market: السوق الجغرافي إن ذُكر، وإلا اتركه فارغًا.
- sizeSignal: أي إشارة لحجم الشركة (عدد العملاء، عدد الموظفين، مراحل التمويل) إن ذُكرت، وإلا فارغ.
- offerings: من ٢ إلى ٥ عناصر، أسماء المنتجات أو الخدمات كما وردت.
- competitors: منافسون معروفون في نفس المجال. هذه اقتراحات منك وليست بحثًا، وستُعرض
  للمستخدم على أنها غير مُتحقق منها. اتركها فارغة إذا ما كنت واثقًا.`;

/**
 * The profile, from Claude when there is a key and from the page's own metadata
 * when there is not.
 *
 * The fallback is deliberately thin rather than clever: a title and a meta
 * description are what the site itself says about itself, which is true, and
 * the screen labels it «قراءة مباشرة من الصفحة» so nobody mistakes it for
 * research. lib/intent.ts takes the same shape for the same reason.
 */
export async function analyzeSite(site: SiteText): Promise<AnalyzedProfile> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fromMetadata(site);
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `الرابط: ${site.url}\nالعنوان: ${site.title}\nالوصف: ${site.description}\n\nنص الصفحة:\n${site.text}`,
        },
      ],
      output_config: { format: zodOutputFormat(ProfileSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed?.sells?.trim()) return fromMetadata(site);

    return {
      name: parsed.name.trim() || hostOf(site.url),
      sells: parsed.sells.trim(),
      sellsEn: parsed.sellsEn.trim(),
      market: parsed.market.trim(),
      sizeSignal: parsed.sizeSignal.trim(),
      language: parsed.language.trim() || "ar",
      offerings: parsed.offerings.map((o) => o.trim()).filter(Boolean).slice(0, 5),
      competitors: parsed.competitors
        .filter((c) => c.name.trim())
        .slice(0, 6)
        .map((c) => ({ name: c.name.trim(), website: c.website.trim() || undefined, source: "analysis" as const })),
      source: "claude",
      sourceExcerpt: site.text.slice(0, 400),
    };
  } catch (error) {
    console.warn("[gtm] site analysis fell back to metadata", error);
    return fromMetadata(site);
  }
}

/**
 * What the page says about itself, and nothing more.
 *
 * No competitors: naming a competitor from a meta description would be
 * invention, and an empty grid that says why is better than a populated one
 * that cannot be checked.
 */
export function fromMetadata(site: SiteText): AnalyzedProfile {
  const name = site.title.split(/[|–—\-·]/)[0].trim() || hostOf(site.url);
  const sells = site.description.trim() || site.text.slice(0, 180).trim();
  return {
    name,
    sells,
    sellsEn: "",
    market: "",
    sizeSignal: "",
    language: /[؀-ۿ]/.test(sells) ? "ar" : "en",
    offerings: [],
    competitors: [],
    source: "html",
    sourceExcerpt: site.text.slice(0, 400),
  };
}
