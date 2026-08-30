import type { Database } from "../db";
import { db as defaultDb } from "../db";
import type { DraftTemplate } from "../types";
import { compose, type Recipient, type SegmentContext, type Sender } from "./compose";
import * as repo from "./repo";

/**
 * Turning revealed people into drafts.
 *
 * Only people we actually bought get a draft. A row that is still an id has
 * nothing to write about, and the composer's thin path exists for the person
 * whose *record* is sparse — not as a way to paper over a row we simply have
 * not paid for yet.
 */

export function senderFrom(profile: repo.ProfileRow, displayName: string): Sender {
  return {
    company: profile.name,
    sells: profile.sells,
    sellsEn: profile.sellsEn || undefined,
    person: displayName,
    website: profile.websiteUrl ? new URL(profile.websiteUrl).hostname.replace(/^www\./, "") : undefined,
    market: profile.market || undefined,
  };
}

export function segmentContextFrom(segment: repo.SegmentRow): SegmentContext {
  return {
    name: segment.name,
    nameEn: segment.nameEn || undefined,
    pain: segment.pain,
    painEn: segment.painEn || undefined,
    criteria: segment.criteria,
  };
}

export function recipientFrom(person: repo.PersonRow, company?: repo.CompanyRow): Recipient {
  return {
    fullName: person.fullName,
    firstName: person.firstName ?? undefined,
    title: person.title || undefined,
    companyName: person.companyName || company?.name || undefined,
    industry: company?.industry ?? undefined,
    employeesCount: company?.employeesCount ?? null,
    hqCountry: company?.hqCountry ?? undefined,
  };
}

/**
 * Composes (or recomposes) drafts for every revealed person in a run.
 *
 * `upsertDraft` will not overwrite a draft the user has edited, so changing the
 * template regenerates the untouched ones and leaves someone's own writing
 * alone. That asymmetry is deliberate: losing a generated paragraph is nothing,
 * and losing a sentence a person wrote themselves is unforgivable.
 */
export async function composeDraftsForRun(
  runId: string,
  accountId: string,
  displayName: string,
  template: DraftTemplate,
  database: Database = defaultDb,
): Promise<number> {
  const bundle = await repo.loadRun(runId, accountId, database);
  if (!bundle?.profile) return 0;

  const sender = senderFrom(bundle.profile, displayName);
  const companies = new Map(bundle.companies.map((c) => [c.id, c]));
  let written = 0;

  for (const segment of bundle.segments) {
    const context = segmentContextFrom(segment);
    const revealed = bundle.people.filter((p) => p.segmentId === segment.id && p.collectedAt && p.fullName);
    for (const person of revealed) {
      const composed = compose({
        sender,
        recipient: recipientFrom(person, person.companyId ? companies.get(person.companyId) : undefined),
        segment: context,
        template,
      });
      await repo.upsertDraft(
        { personId: person.id, accountId, segmentId: segment.id, template, composed },
        database,
      );
      written++;
    }
  }
  return written;
}
