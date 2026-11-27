import type {
  CallOptions, Company, FoundPerson, Priced, Signal, SourcingProvider,
} from "./provider";

/**
 * People data through treg's routed tools (https://treg.to). treg picks the
 * provider, falls through on a miss, and bills only what answers. We send:
 *
 *  - X-Treg-Route-Max-Cost: the per-call ceiling, from the request's remaining
 *    budget, so a waterfall can never overspend it;
 *  - Idempotency-Key: a workflow step that retries after a timeout gets the
 *    stored answer instead of paying again;
 *  - X-Treg-Route-Strict-Filters on people search: a provider that would ignore
 *    the Saudi country filter is skipped rather than returning other countries.
 *
 * The charge is read from X-Treg-Cost-Micro, never from the body.
 */

const BASE = "https://treg.to/call";

/** Web-search routes treg measured as unreliable; skipping them saves paid misses. */
const FLAKY_SEARCH = "crawl4ai,spidercloud,search1api,olostep,scrapegraphai";

export class TregError extends Error {
  constructor(readonly status: number, readonly tool: string, detail: string) {
    super(`treg ${tool} answered ${status}: ${detail.slice(0, 300)}`);
  }
}

export class TregProvider implements SourcingProvider {
  /**
   * The default wraps the global: Workers throws "Illegal invocation" when
   * `fetch` is called as a method (`this.fetcher(...)`), which broke every
   * sourcing run inside the request workflow.
   */
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async call<T>(
    tool: string, body: Record<string, unknown>, options: CallOptions,
    extra: Record<string, string> = {},
  ): Promise<{ output: T; raw?: unknown; costMicro: number; servedBy: string; verification?: { verdict?: string } }> {
    const response = await this.fetcher(`${BASE}/${tool}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-treg-token": this.token,
        "x-treg-route-max-cost": options.maxCostUsd.toFixed(4),
        "idempotency-key": options.idempotencyKey,
        ...extra,
      },
      body: JSON.stringify(body),
    });
    const costMicro = Number(response.headers.get("x-treg-cost-micro") ?? 0) || 0;
    if (!response.ok) throw new TregError(response.status, tool, await response.text());
    const json = (await response.json()) as { output?: T; raw?: unknown; _treg?: { served_by?: string; verification?: { verdict?: string } } };
    return {
      output: (json.output ?? {}) as T,
      raw: json.raw,
      costMicro,
      verification: json._treg?.verification,
      servedBy: json._treg?.served_by ?? response.headers.get("x-treg-served-by") ?? "treg",
    };
  }

  /**
   * A member's public LinkedIn profile, for onboarding. The routed contract
   * gives name, headline, location and about; the current employer is only in
   * some providers' raw answers, so it is read best-effort.
   */
  async readProfile(linkedinUrl: string, options: CallOptions): Promise<Priced<ProfileRead | null>> {
    const r = await this.call<{ full_name?: string; first_name?: string; headline?: string | null; location?: string; about?: string; linkedin_url?: string }>(
      "treg.linkedin.user.profile", { linkedin_url: linkedinUrl }, options, { "x-treg-route-waterfall": "1" },
    );
    const raw = (Array.isArray(r.raw) ? r.raw[0] : r.raw) as Record<string, unknown> | undefined;
    const pick = (...keys: string[]) => { for (const k of keys) { const v = k.split(".").reduce<unknown>((o, x) => (o as Record<string, unknown> | undefined)?.[x], raw); if (typeof v === "string" && v.trim()) return v.trim(); } return undefined; };
    const o = r.output;
    if (!o.full_name) return { value: null, costMicro: r.costMicro };
    return {
      value: {
        name: o.full_name,
        headline: o.headline ?? pick("position", "headline", "occupation"),
        location: o.location,
        about: o.about?.slice(0, 400),
        company: pick("current_company_name", "current_company.name", "company", "companyName"),
        linkedinUrl: o.linkedin_url ?? linkedinUrl,
      },
      costMicro: r.costMicro,
    };
  }

  /** A company from its website, for onboarding: what it does, its industry and size. */
  async enrichCompany(domain: string, options: CallOptions): Promise<Priced<CompanyRead | null>> {
    const r = await this.call<{ name?: string; domain?: string; description?: string; industry?: string; employees?: number; linkedin_url?: string }>(
      "treg.companies.enrich", { domain }, options,
    );
    const o = r.output;
    if (!o.name) return { value: null, costMicro: r.costMicro };
    return {
      value: { name: o.name, domain: o.domain ?? domain, description: o.description?.slice(0, 400), industry: o.industry, employees: o.employees, linkedinUrl: o.linkedin_url },
      costMicro: r.costMicro,
    };
  }

  async findCompanies(
    query: { industry?: string; q?: string; name?: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<Company[]>> {
    const body = query.name
      ? { name: query.name, country: query.country, limit: query.limit }
      : query.industry
        ? { industry: query.industry, country: query.country, limit: query.limit }
        : { q: query.q, country: query.country, limit: query.limit };
    // wiza answered a Saudi sector search with one unrelated company for $0.0127.
    const r = await this.call<{ companies?: RawCompany[] }>("treg.companies.search", body, options, { "x-treg-route-exclude": "wiza" });
    const companies = (r.output.companies ?? [])
      .filter((c) => { const country = str(c.country); return !country || country.toUpperCase() === query.country; })
      .map(toCompany)
      .filter((c): c is Company => c !== null);
    return { value: companies, costMicro: r.costMicro };
  }

  async findPeople(
    query: { companyDomain: string; title?: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>> {
    return this.searchPeople(query, options);
  }

  /** A role across a sector: semantic, with the market in the text and the location. */
  async findPeopleInSector(
    query: { title: string; industry: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>> {
    const where = query.country === "SA" ? "Saudi Arabia" : query.country;
    // Semantic search can drift abroad; run.ts keeps only people in the market.
    return this.searchPeople({ q: `${query.title} at ${query.industry} companies in ${where}`, location: where, limit: query.limit }, options);
  }

  /**
   * People by any identity treg routes on: a company domain (+ title), a
   * free-text description (q, semantic), or one person's name. A structured
   * search is strict about the market, so no provider can ignore it; a
   * semantic one carries the market in its text and location instead.
   */
  async searchPeople(
    query: {
      companyDomain?: string; title?: string; q?: string; fullName?: string;
      keywords?: string[]; country?: string; location?: string; limit: number;
    },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>> {
    const body: Record<string, unknown> = { limit: query.limit };
    if (query.companyDomain) body.company_domain = query.companyDomain;
    if (query.title) body.title = query.title;
    if (query.q) body.q = query.q;
    if (query.fullName) body.full_name = query.fullName;
    if (query.keywords?.length) body.keywords = query.keywords;
    if (query.country) body.country = query.country;
    if (query.location) body.location = query.location;
    const strict: Record<string, string> = !query.q && query.country ? { "x-treg-route-strict-filters": "1" } : {};
    const r = await this.call<{ people?: RawPerson[] }>("treg.people.search", body, options, strict);
    const people = (r.output.people ?? [])
      // A name lookup's provider returns name, location and profile only.
      .filter((p) => str(p.name) && (str(p.title) || query.fullName))
      .map((p) => ({
        name: str(p.name)!,
        title: str(p.title) ?? "",
        company: str(p.company) ?? "",
        companyDomain: str(p.company_domain) ?? query.companyDomain ?? "",
        profileUrl: cleanUrl(str(p.profile_url) ?? str(p.linkedin_url)),
        location: str(p.location),
        servedBy: r.servedBy,
      }));
    return { value: people, costMicro: r.costMicro };
  }

  async findSignals(query: { q: string; limit: number }, options: CallOptions): Promise<Priced<Signal[]>> {
    const r = await this.call<{ results?: RawResult[] }>(
      "treg.web.search", { q: query.q, limit: query.limit }, options,
      { "x-treg-route-exclude": FLAKY_SEARCH },
    );
    const signals = (r.output.results ?? [])
      .filter((x) => /^https?:\/\//.test(str(x.url) ?? "") && str(x.title))
      .map((x) => ({
        url: str(x.url)!,
        title: str(x.title)!,
        source: hostOf(str(x.url)!),
        date: isoDate(str(x.date) ?? str(x.published_date)),
        snippet: str(x.snippet),
      }));
    return { value: signals, costMicro: r.costMicro };
  }

  /**
   * A person's work email, checked in the same call (X-Treg-Route-Verify).
   * Strict domain match: an address at a former employer is not this lead's.
   * Misses are free; a hit and its check are billed.
   */
  async findEmail(
    query: { fullName: string; domain?: string; linkedinUrl?: string },
    options: CallOptions,
  ): Promise<Priced<{ email: string | null; verdict: EmailVerdict; servedBy: string }>> {
    const body: Record<string, unknown> = { full_name: query.fullName };
    if (query.domain) body.domain = query.domain;
    if (query.linkedinUrl) body.linkedin_url = query.linkedinUrl;
    const r = await this.call<{ email?: string | null }>("treg.people.email.find", body, options, {
      "x-treg-route-verify": "true",
      ...(query.domain ? { "x-treg-route-domain-match": "strict" } : {}),
    });
    const email = typeof r.output.email === "string" && r.output.email.includes("@") ? r.output.email.toLowerCase() : null;
    return {
      value: { email, verdict: email ? verdictOf(r.verification) : "not_found", servedBy: r.servedBy },
      costMicro: r.costMicro,
    };
  }
}

export type EmailVerdict = "valid" | "risky" | "invalid" | "not_found";

/** treg's verification verdict, folded to the four states a lead shows. */
export function verdictOf(v?: { verdict?: string }): EmailVerdict {
  const verdict = (v?.verdict ?? "").toLowerCase();
  if (/invalid|undeliverable|bad/.test(verdict)) return "invalid";
  if (/^valid|deliverable|ok|safe/.test(verdict)) return "valid";
  return "risky";
}

interface RawCompany {
  name?: unknown; organization?: unknown; company_name?: unknown; website_url?: unknown; website?: unknown; domain?: unknown;
  country?: unknown; industry?: unknown; company_size?: unknown; linkedin_url?: unknown;
}
interface RawPerson {
  name?: unknown; title?: unknown; company?: unknown; company_domain?: unknown;
  profile_url?: unknown; linkedin_url?: unknown; location?: unknown;
}
interface RawResult { url?: unknown; title?: unknown; date?: unknown; published_date?: unknown; snippet?: unknown }

function toCompany(c: RawCompany): Company | null {
  const name = str(c.name) ?? str(c.organization) ?? str(c.company_name);
  const domain = (str(c.domain) ?? str(c.website_url) ?? str(c.website) ?? "").toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!name || !domain) return null;
  const size = typeof c.company_size === "number" ? String(c.company_size) : str(c.company_size);
  return { name, domain, industry: str(c.industry), size, linkedinUrl: str(c.linkedin_url) };
}

/**
 * A provider field as text, or undefined. Providers answer the same contract
 * with different shapes (a list of industries, a numeric size, an object for
 * a website), and one odd row must never fail a whole search.
 */
function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return str(v[0]);
  return undefined;
}

function cleanUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export interface ProfileRead { name: string; headline?: string; location?: string; about?: string; company?: string; linkedinUrl: string }
export interface CompanyRead { name: string; domain: string; description?: string; industry?: string; employees?: number; linkedinUrl?: string }
