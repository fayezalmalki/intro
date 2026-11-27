/**
 * Where people data comes from. Production uses treg (lib/sourcing/treg.ts);
 * tests use an in-memory provider. Every call reports what it cost, so the
 * request's budget is enforced by the caller rather than trusted to the
 * provider.
 */

export interface Company {
  name: string;
  domain: string;
  industry?: string;
  size?: string;
  linkedinUrl?: string;
}

export interface FoundPerson {
  name: string;
  title: string;
  company: string;
  companyDomain: string;
  profileUrl?: string;
  location?: string;
  /** Which upstream provider answered, for provenance (PDPL). */
  servedBy: string;
}

export interface Signal {
  url: string;
  title: string;
  /** The page's host, shown as the source. */
  source: string;
  /** ISO date (YYYY-MM-DD) when the provider gave one. */
  date?: string;
  snippet?: string;
}

export interface Priced<T> {
  value: T;
  costMicro: number;
}

export interface CallOptions {
  /** USD ceiling for this one call. */
  maxCostUsd: number;
  /** Repeating a call with the same key never pays twice (a retried workflow step). */
  idempotencyKey: string;
}

export interface SourcingProvider {
  findCompanies(
    query: { industry?: string; q?: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<Company[]>>;
  /** People at one company. Without a title: everyone the provider lists (we filter). */
  findPeople(
    query: { companyDomain: string; title?: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>>;
  /** People in a role across a whole sector, when company-by-company finds too few. */
  findPeopleInSector?(
    query: { title: string; industry: string; country: string; limit: number },
    options: CallOptions,
  ): Promise<Priced<FoundPerson[]>>;
  findSignals(query: { q: string; limit: number }, options: CallOptions): Promise<Priced<Signal[]>>;
}

export class BudgetExhausted extends Error {
  constructor(readonly spentMicro: number) {
    super(`sourcing budget exhausted after ${spentMicro} micro-USD`);
  }
}
