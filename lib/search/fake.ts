import type { EmailVerdict } from "../sourcing/treg";
import type { Company, FoundPerson, Priced, Signal } from "../sourcing/provider";
import type { Searcher } from "./service";

/**
 * Offline stand-in for treg in development and tests (no TREG_TOKEN). Every
 * company and person here is fictional, and marked as served by "offline".
 */
const COMPANIES: Company[] = [
  { name: "Qimma Insurance", domain: "qimma-insurance.example", industry: "Insurance", size: "1K-5K" },
  { name: "Lumen Pay", domain: "lumenpay.example", industry: "Financial Services", size: "51-250" },
  { name: "Nuwa Logistics", domain: "nuwa-logistics.example", industry: "Logistics and Supply Chain", size: "251-1K" },
  { name: "Rawabi Clinics", domain: "rawabi-clinics.example", industry: "Hospital & Health Care", size: "1K-5K" },
  { name: "Sahl Retail", domain: "sahl-retail.example", industry: "Retail", size: "5K-10K" },
  { name: "Thuraya Ventures", domain: "thuraya.example", industry: "Venture Capital & Private Equity", size: "11-50" },
];

const TITLES = ["Chief Executive Officer", "Chief Digital Officer", "Head of Procurement", "VP Product", "Director of Partnerships", "Data Analyst"];
const NAMES = ["Faisal Alotaibi", "Noura Alsaud", "Reem Alshehri", "Majed Alqahtani", "Lama Fahad", "Omar Haddad"];

const priced = <T>(value: T): Priced<T> => ({ value, costMicro: 0 });

export class FakeSearch implements Searcher {
  async findCompanies(q: { industry?: string; q?: string; name?: string }) {
    const needle = (q.name ?? q.industry ?? q.q ?? "").toLowerCase();
    const hits = COMPANIES.filter((c) => !needle || needle.includes((c.industry ?? "").toLowerCase().split(" ")[0]) || c.name.toLowerCase().includes(needle));
    return priced(hits.length ? hits : COMPANIES);
  }

  async searchPeople(q: { companyDomain?: string; title?: string; fullName?: string }) {
    const companies = q.companyDomain ? COMPANIES.filter((c) => c.domain === q.companyDomain) : COMPANIES;
    const pool = companies.length ? companies : COMPANIES;
    const people: FoundPerson[] = NAMES.map((name, i) => {
      const c = pool[i % pool.length];
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      return {
        name: q.fullName ?? name,
        title: q.title && i < 3 ? `${q.title} ${i === 0 ? "Officer" : "Lead"}`.trim() : TITLES[i],
        company: c.name,
        companyDomain: c.domain,
        profileUrl: `https://www.linkedin.com/in/${slug}-offline-${i}`,
        location: "Riyadh, Saudi Arabia",
        servedBy: "offline",
      };
    });
    return priced(q.fullName ? people.slice(0, 2) : people);
  }

  async findSignals(q: { q: string }) {
    const today = new Date();
    const day = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
    const signals: Signal[] = [
      { url: "https://example.com/news/1", title: `Expansion announced — ${q.q.slice(0, 40)}`, source: "example.com", date: day(4) },
      { url: "https://example.com/news/2", title: "New leadership appointment", source: "example.com", date: day(21) },
    ];
    return priced(signals);
  }

  async findEmail(q: { fullName: string; domain?: string }) {
    const [first, last] = q.fullName.toLowerCase().split(/\s+/);
    const verdict: EmailVerdict = "valid";
    return priced({ email: q.domain ? `${first}.${last ?? "x"}@${q.domain}` : null, verdict: q.domain ? verdict : "not_found" as EmailVerdict, servedBy: "offline" });
  }
}
