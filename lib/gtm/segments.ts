import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SegmentOrigin } from "../types";
import type { AnalyzedProfile } from "./profile";

/**
 * Step 3: the campaigns screen, which is the one that has to be right.
 *
 * A segment is a claim that a particular kind of company exists, hurts in a
 * particular way, and can be counted. The first two are judgement and the user
 * can edit them; the third is a fact, and lib/gtm/counts.ts will only render it
 * when a real free search produced it.
 *
 * The model's job here stops at the description, the pain and the criteria. It
 * does **not** name example companies and it does not produce counts — those
 * come from the vendor or they do not appear. Explee's screen shows both; the
 * difference is that ours can say where each came from.
 */

export interface DraftSegment {
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  pain: string;
  criteria: string[];
  /** The structured filter this segment will be counted with. */
  filter: SegmentFilter;
  origin: SegmentOrigin;
}

/**
 * The machine-readable half of a segment.
 *
 * Deliberately a small closed shape rather than free text: it is turned into a
 * Coresignal query verbatim, stored next to the count it produced, and shown to
 * the user. A filter nobody can read is a count nobody can check.
 */
export interface SegmentFilter {
  country: string;
  industry?: string;
  employeesMin?: number;
  employeesMax?: number;
  /** Free-text terms matched against the company record. */
  keywords?: string[];
}

const SegmentsSchema = z.object({
  segments: z.array(
    z.object({
      name: z.string(),
      nameEn: z.string(),
      icon: z.string(),
      description: z.string(),
      pain: z.string(),
      criteria: z.array(z.string()),
      industry: z.string(),
      employeesMin: z.number(),
      employeesMax: z.number(),
      keywords: z.array(z.string()),
    }),
  ),
});

const SYSTEM = `أنت تبني حملات وصول للسوق لشركة سعودية.
تُعطى ملف الشركة، وتقترح من ٤ إلى ٦ شرائح عملاء محتملين.

لكل شريحة:
- name: اسم الشريحة بالعربي، جملة اسمية قصيرة.
- nameEn: نفس الاسم بالإنجليزية.
- icon: رمز واحد فقط من: ◆ ▲ ● ■ ★ ✦
- description: سطر واحد بالعربي يوصف من هم وما الذي يميزهم كمشترين.
- pain: الوجع الذي تعالجه لهم، بجملة واحدة محددة بالعربي السعودي المهني.
  تُستخدم داخل رسالة تُرسل لهم، فاكتبها كما تُقال لهم لا عنهم.
- criteria: ثلاث نقاط تحدد الشريحة تحديدًا قابلًا للبحث (القطاع، الحجم، إشارة سلوكية).
- industry / employeesMin / employeesMax / keywords: نفس المعايير بشكل قابل للبحث الآلي.
  employeesMin و employeesMax أرقام؛ استخدم 0 إذا ما فيه حد.

قواعد صارمة:
- لا تذكر أسماء شركات. الأسماء تأتي من بحث حقيقي لاحقًا، لا منك.
- لا تذكر أي رقم عن حجم السوق أو عدد الشركات.
- لا تخترع خصائص عن الشركة صاحبة الملف.`;

const ICONS = ["◆", "▲", "●", "■", "★", "✦"];

export async function proposeSegments(profile: AnalyzedProfile): Promise<DraftSegment[]> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fallbackSegments(profile);
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `الشركة: ${profile.name}`,
            `تبيع: ${profile.sells}`,
            profile.market ? `السوق: ${profile.market}` : "",
            profile.offerings.length ? `المنتجات: ${profile.offerings.join("، ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(SegmentsSchema) },
    });

    const parsed = response.parsed_output?.segments ?? [];
    const usable = parsed.filter((s) => s.name.trim() && s.pain.trim());
    if (usable.length === 0) return fallbackSegments(profile);

    return usable.slice(0, 6).map((s, i) => ({
      name: s.name.trim(),
      nameEn: s.nameEn.trim(),
      icon: ICONS.includes(s.icon) ? s.icon : ICONS[i % ICONS.length],
      description: s.description.trim(),
      pain: s.pain.trim(),
      criteria: s.criteria.map((c) => c.trim()).filter(Boolean).slice(0, 3),
      filter: {
        country: profile.market || "Saudi Arabia",
        industry: s.industry.trim() || undefined,
        employeesMin: s.employeesMin > 0 ? s.employeesMin : undefined,
        employeesMax: s.employeesMax > 0 ? s.employeesMax : undefined,
        keywords: s.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 4),
      },
      origin: "ai" as const,
    }));
  } catch (error) {
    console.warn("[gtm] segment generation fell back to rules", error);
    return fallbackSegments(profile);
  }
}

/**
 * Three segments cut by company size, with no key configured.
 *
 * Size is the one axis we can split honestly without a model: it comes from the
 * user's own market, it is exactly what the free company search filters on, and
 * the resulting counts are real. The pains are written as the general shape of
 * the problem at each size, and the screen marks these `rules` so the user
 * knows to rewrite them — which is why editing a segment is a first-class
 * action rather than a nicety.
 */
export function fallbackSegments(profile: AnalyzedProfile): DraftSegment[] {
  const country = profile.market || "Saudi Arabia";
  // A criterion is a bullet, not a paragraph: the company's own name reads as a
  // criterion, a three-sentence positioning line does not.
  const what = profile.name || "منتجك";
  return [
    {
      name: "شركات متوسطة في السوق السعودي",
      nameEn: "Mid-size companies in Saudi Arabia",
      icon: "◆",
      description: `شركات من ٥٠ إلى ٢٠٠ موظف، كبيرة كفاية عشان يكون عندها ميزانية وصغيرة كفاية عشان القرار يمر بسرعة.`,
      pain: "القرار عندكم يمر بشخص أو اثنين، بس ما فيه فريق مخصص يقيّم المزوّدين، فالمشاريع تتأجل بدل ما تُرفض",
      criteria: ["مقرها السعودية", "من ٥٠ إلى ٢٠٠ موظف", `قريبة من: ${what}`],
      filter: { country, employeesMin: 50, employeesMax: 200 },
      origin: "rules",
    },
    {
      name: "شركات كبيرة ومجموعات",
      nameEn: "Large companies and groups",
      icon: "▲",
      description: "أكثر من ٢٠٠ موظف. دورة الشراء أطول، لكن العقد أكبر وأثبت.",
      pain: "الشراء عندكم يمر على أربع طبقات قبل ما يوصل صاحب القرار، والدورة تطول لشهور بدون سبب واضح",
      criteria: ["مقرها السعودية", "أكثر من ٢٠٠ موظف", `قريبة من: ${what}`],
      filter: { country, employeesMin: 200 },
      origin: "rules",
    },
    {
      name: "شركات ناشئة ونامية",
      nameEn: "Startups and scale-ups",
      icon: "●",
      description: "من ١٠ إلى ٥٠ موظف. تقرر بسرعة، وتشتري لما تحس بالوجع مباشرة.",
      pain: "الفريق صغير، فكل شيء يمر على نفس الشخصين، وأي شغل يدني متكرر ياخذ من وقت البناء",
      criteria: ["مقرها السعودية", "من ١٠ إلى ٥٠ موظف", `قريبة من: ${what}`],
      filter: { country, employeesMin: 10, employeesMax: 50 },
      origin: "rules",
    },
  ];
}
