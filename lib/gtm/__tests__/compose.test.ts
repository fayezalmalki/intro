import { describe, expect, it } from "vitest";
import {
  compose,
  firstNameOf,
  isThin,
  specificsFor,
  TEMPLATE_IDS,
  wordCount,
  type ComposeInput,
  type Recipient,
} from "../compose";
import { EXAMPLE_SEGMENTS, EXAMPLE_SENDER, workedExamples } from "../fixtures";
import type { DraftTemplate } from "../../types";

/**
 * The composer is the product, so these are not smoke tests.
 *
 * The property that matters is the one that is easiest to lose in a refactor:
 * a draft may only contain claims the input actually supports. Half of these
 * assert the presence of a specific — the other, more important half assert the
 * *absence* of one when the data is not there.
 */

const SEGMENT = EXAMPLE_SEGMENTS[0];

function input(recipient: Recipient, template: DraftTemplate = "direct"): ComposeInput {
  return { sender: EXAMPLE_SENDER, recipient, segment: SEGMENT, template };
}

const FULL: Recipient = {
  fullName: "نورة العتيبي",
  firstName: "نورة",
  title: "مديرة المبيعات",
  companyName: "شركة مثال",
  industry: "برمجيات كخدمة",
  employeesCount: 84,
};

describe("specificsFor", () => {
  it("pairs every claim with the field it came from", () => {
    expect(specificsFor(FULL).map((s) => s.field)).toEqual([
      "title+company",
      "industry",
      "employees_count",
    ]);
  });

  it("says nothing about headcount when there is no headcount", () => {
    const fields = specificsFor({ ...FULL, employeesCount: null }).map((s) => s.field);
    expect(fields).not.toContain("employees_count");
  });

  /** Zero is a value the vendor returns for shell records. It is not a team. */
  it("treats a zero headcount as no headcount", () => {
    expect(specificsFor({ ...FULL, employeesCount: 0 }).map((s) => s.field))
      .not.toContain("employees_count");
  });

  it("has nothing to say about a bare name", () => {
    expect(specificsFor({ fullName: "عبدالله الشمري" })).toEqual([]);
    expect(isThin({ fullName: "عبدالله الشمري" })).toBe(true);
  });

  /** A title alone is enough to write a specific letter. */
  it("counts a title on its own as specific", () => {
    expect(isThin({ fullName: "سارة", title: "مديرة المنتج" })).toBe(false);
  });
});

describe("firstNameOf", () => {
  it("prefers the explicit first name", () => {
    expect(firstNameOf({ fullName: "نورة العتيبي", firstName: "نورة" })).toBe("نورة");
  });

  /** Coresignal returns `full_name` far more often than the split fields. */
  it("falls back to the first token, in either script", () => {
    expect(firstNameOf({ fullName: "طارق الحربي" })).toBe("طارق");
    expect(firstNameOf({ fullName: "Tariq Alharbi" })).toBe("Tariq");
  });
});

describe("compose", () => {
  it("names the recipient's own title, company and headcount", () => {
    const draft = compose(input(FULL));
    expect(draft.bodyAr).toContain("مديرة المبيعات في شركة مثال");
    expect(draft.bodyAr).toContain("84");
    expect(draft.thin).toBe(false);
  });

  /**
   * The rule the whole file exists for. With nothing but a name, the letter
   * must get shorter and admit it — not keep the confident sentence and drop
   * the blank.
   */
  it("admits it knows nothing rather than inventing a reason", () => {
    const draft = compose(input({ fullName: "عبدالله الشمري" }));
    expect(draft.thin).toBe(true);
    expect(draft.specifics).toEqual([]);
    expect(draft.bodyAr).toContain("ما عندي تفاصيل كافية");
    expect(draft.bodyAr).not.toContain("وصلت لك تحديدًا لأنك");
    expect(draft.bodyEn).toContain("I don't have enough detail");
  });

  it("never states a headcount it was not given", () => {
    const draft = compose(input({ ...FULL, employeesCount: null }));
    expect(draft.bodyAr).not.toMatch(/حجم الفريق/);
    expect(draft.bodyEn).not.toMatch(/the team is around/);
  });

  /**
   * Every claim in the body has to be traceable. Rather than parse Arabic
   * prose, assert the contrapositive that actually protects us: each recorded
   * specific's own words appear in the letter, so `specifics` cannot drift into
   * a decorative field that says one thing while the body says another.
   */
  it("puts every recorded specific into the body it describes", () => {
    const draft = compose(input(FULL));
    const withCompany = draft.specifics.find((s) => s.field === "title+company");
    expect(draft.bodyAr).toContain(withCompany!.text);
    expect(draft.bodyAr).toContain("84");
  });

  it("greets without guessing at gender", () => {
    // «أ.» is أستاذ/أستاذة both. The vendor gives us a name string and nothing
    // that would let us choose between them.
    expect(compose(input(FULL)).bodyAr.startsWith("السلام عليكم أ. نورة،")).toBe(true);
  });

  it("writes the female title without a masculine verb in front of it", () => {
    // An earlier draft said «تشغل دور مديرة المبيعات», which is wrong for half
    // the recipients. The title carries the gender; the clause must not.
    expect(compose(input(FULL)).bodyAr).not.toContain("تشغل دور");
  });

  it.each(TEMPLATE_IDS)("stays under the first-touch word ceiling: %s", (template) => {
    // docs/03-design-review.md §4: ~120 words on a first touch.
    const draft = compose(input(FULL, template));
    expect(wordCount(draft.bodyAr)).toBeLessThanOrEqual(120);
    expect(wordCount(draft.bodyEn)).toBeLessThanOrEqual(120);
  });

  it.each(TEMPLATE_IDS)("carries no link in the body: %s", (template) => {
    const draft = compose(input(FULL, template));
    const body = draft.bodyAr.split("\n\n").slice(0, -1).join("\n\n");
    expect(body).not.toMatch(/https?:\/\//);
    // The sender's own site belongs in the signature, where a reader expects it.
    expect(draft.bodyAr).toContain("intro.sa");
  });

  it("gives each template a different ask", () => {
    const bodies = TEMPLATE_IDS.map((t) => compose(input(FULL, t)).bodyAr);
    expect(new Set(bodies).size).toBe(TEMPLATE_IDS.length);
    expect(bodies[TEMPLATE_IDS.indexOf("warm_intro")]).toContain("ما أبي أبيعك شيء");
    expect(bodies[TEMPLATE_IDS.indexOf("partnership")]).toContain("شكلًا مشتركًا");
  });

  describe("the English variant", () => {
    it("is a rewrite, not the Arabic in an English frame", () => {
      const draft = compose(input(FULL));
      expect(draft.englishComplete).toBe(true);
      expect(draft.bodyEn).toContain("We help Saudi teams");
      expect(draft.bodyEn).not.toContain("نساعد الفرق السعودية");
    });

    /**
     * The honest failure. A profile with no English line still produces an
     * English body, because refusing would leave the toggle broken — but it
     * reports that the body borrowed Arabic, and the UI says so instead of
     * presenting a finished English letter.
     */
    it("reports itself incomplete when there was no English source", () => {
      const draft = compose({
        ...input(FULL),
        sender: { ...EXAMPLE_SENDER, sellsEn: undefined },
      });
      expect(draft.englishComplete).toBe(false);
      expect(draft.bodyEn).toContain(EXAMPLE_SENDER.sells);
    });

    it("capitalises the sentence it was handed as a fragment", () => {
      expect(compose(input(FULL)).bodyEn).not.toMatch(/\. [a-z]/);
    });
  });
});

describe("the worked examples", () => {
  const examples = workedExamples();

  it("covers every template and the thin case", () => {
    expect(new Set(examples.map((e) => e.template))).toEqual(new Set(TEMPLATE_IDS));
    expect(examples.some((e) => e.draft.thin)).toBe(true);
  });

  /** They render with no key, no credit and no database row — that is the point. */
  it("produce a body and a subject for each", () => {
    for (const e of examples) {
      expect(e.draft.bodyAr.length).toBeGreaterThan(80);
      expect(e.draft.subjectAr.length).toBeGreaterThan(4);
    }
  });
});
