import { describe, expect, it } from "vitest";
import { cleanLead, cleanLinkedin, cleanTags, leadsFromCsv, parseCsv } from "../crm";

describe("CRM without sending: parsing", () => {
  it("validates a hand-entered lead", () => {
    expect(cleanLead({ name: "", company: "X" })).toBeNull();
    const l = cleanLead({ name: " Noura ", company: "Lumen Pay", email: "NOURA@lumenpay.sa", linkedin: "https://www.linkedin.com/in/Noura-S/?x=1", tags: "event، warm,warm", stage: "اجتماع", value: "SAR 25,000" })!;
    expect(l).toMatchObject({ name: "Noura", email: "noura@lumenpay.sa", linkedinUrl: "https://www.linkedin.com/in/noura-s", tags: ["event", "warm"], stage: "meeting", value: 25000 });
    expect(cleanLead({ name: "A", company: "B", email: "not-an-email" })!.email).toBeUndefined();
  });

  it("parses quoted CSV, picks the separator from the header, maps Arabic headers", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
    const { leads, skipped } = leadsFromCsv("الاسم;الشركة;الوسوم;المرحلة\nفيصل;قمة;معرض|دافئ;تواصلت\n;بلا اسم;;\n");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: "فيصل", company: "قمة", tags: ["معرض", "دافئ"], stage: "contacted" });
    expect(skipped).toBe(1);
  });

  it("round-trips the export headers", () => {
    const csv = "﻿Name,Title,Company,Company domain,Email,Email status,Phone,LinkedIn,Location,Market,Stage,Tags,Next step,Next step date,Value,Note,Saved\n" +
      "Reem,CFO,Qimma,qimma.sa,reem@qimma.sa,valid,+966 50,https://www.linkedin.com/in/reem,Riyadh,sa,replied,a|b,Send deck,2026-12-01,5000,Met at LEAP,2026-11-27";
    const { leads, unknownColumns } = leadsFromCsv(csv);
    expect(leads[0]).toMatchObject({ name: "Reem", company: "Qimma", stage: "replied", tags: ["a", "b"], value: 5000, note: "Met at LEAP" });
    expect(unknownColumns).toContain("Next step");
  });

  it("normalizes tags and LinkedIn", () => {
    expect(cleanTags(["a", " a ", "b|c"])).toEqual(["a", "b", "c"]);
    expect(cleanLinkedin("linkedin.com/company/x")).toBeUndefined();
  });
});
