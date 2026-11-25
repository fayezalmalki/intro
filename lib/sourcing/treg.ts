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
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}

  private async call<T>(
    tool: string, body: Record<string, unknown>, options: CallOptions,
    extra: Record<string, string> = {},
  ): Promise<{ output: T; costMicro: number; servedBy: string }> {
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
    const json = (await response.json()) as { output?: T; _treg?: { served_by?: string } };
    return {
      output: (json.output ?? {}) as T,
      costMicro,
      servedBy: json._treg?.served_by ?? response.headers.get("x-treg-served-by") ?? "treg",
    };
  }

  async findCompanies(
    query: { industry?: string; q?: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<Company[]>> {
    const body = query.industry
      ? { industry: query.industry, country: query.country, limit: query.limit }
      : { q: query.q, country: query.country, limit: query.limit };
    const r = await this.call<{ companies?: RawCompany[] }>("treg.companies.search", body, options);
    const companies = (r.output.companies ?? [])
      .filter((c) => !c.country || c.country.toUpperCase() === query.country)
      .map(toCompany)
      .filter((c): c is Company => c !== null);
    return { value: companies, costMicro: r.costMicro };
  }

  async findPeople(
    query: { companyDomain: string; title: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>> {
    const r = await this.call<{ people?: RawPerson[] }>(
      "treg.people.search",
      { company_domain: query.companyDomain, title: query.title, country: query.country, limit: query.limit },
      options,
      { "x-treg-route-strict-filters": "1" },
    );
    const people = (r.output.people ?? [])
      .filter((p) => p.name && p.title)
      .map((p) => ({
        name: p.name!.trim(),
        title: p.title!.trim(),
        company: p.company ?? "",
        companyDomain: p.company_domain ?? query.companyDomain,
        profileUrl: cleanUrl(p.profile_url ?? p.linkedin_url),
        location: p.location,
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
      .filter((x) => x.url && x.title)
      .map((x) => ({
        url: x.url!,
        title: x.title!.trim(),
        source: hostOf(x.url!),
        date: isoDate(x.date ?? x.published_date),
        snippet: x.snippet,
      }));
    return { value: signals, costMicro: r.costMicro };
  }
}

interface RawCompany {
  name?: string; website_url?: string; domain?: string; country?: string;
  industry?: string; company_size?: string; linkedin_url?: string;
}
interface RawPerson {
  name?: string; title?: string; company?: string; company_domain?: string;
  profile_url?: string; linkedin_url?: string; location?: string;
}
interface RawResult { url?: string; title?: string; date?: string; published_date?: string; snippet?: string }

function toCompany(c: RawCompany): Company | null {
  const domain = (c.domain ?? c.website_url ?? "").toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!c.name || !domain) return null;
  return {
    name: c.name.trim(), domain, industry: c.industry, size: c.company_size,
    linkedinUrl: c.linkedin_url,
  };
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
