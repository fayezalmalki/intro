/**
 * The six sector clusters Radar watches.
 *
 * These are the same six the landing already promises to cover — see
 * `SECTORS` in `app/page.tsx`. That is deliberate rather than incidental: a
 * public page that names six sectors and a briefing product that watches five
 * different ones is a promise the product does not keep, and the sector strip
 * is the first thing a visitor reads.
 *
 * A cluster is a *buying committee*, not an industry label. Banking and
 * insurance sit apart despite both being regulated money, because the person
 * who decides is a different person and the regulator in the room is a
 * different regulator.
 */
export const CLUSTERS = [
  { slug: "banking", ar: "البنوك والتقنية المالية", en: "Banking & fintech" },
  { slug: "insurance", ar: "التأمين", en: "Insurance" },
  { slug: "public", ar: "القطاع العام والمشاريع الكبرى", en: "Public sector & giga-projects" },
  { slug: "energy", ar: "الطاقة واللوجستيات", en: "Energy & logistics" },
  { slug: "health", ar: "الصحة", en: "Health" },
  { slug: "enterprise", ar: "تقنية المؤسسات", en: "Enterprise tech" },
] as const;

export type ClusterSlug = (typeof CLUSTERS)[number]["slug"];

export const CLUSTER_SLUGS = CLUSTERS.map((c) => c.slug) as readonly ClusterSlug[];

export function isClusterSlug(value: string): value is ClusterSlug {
  return (CLUSTER_SLUGS as readonly string[]).includes(value);
}

export function clusterBySlug(slug: string) {
  return CLUSTERS.find((c) => c.slug === slug) ?? null;
}

/**
 * The titles a seat change has to match to be worth a brief.
 *
 * Radar is not a job board. A developer joining a bank is not news; the person
 * who owns the budget arriving is. These terms are matched against
 * `active_experience_title` by the same `employeeQuery` the GTM flow uses, so
 * the query that produced a signal is always reproducible from the row.
 *
 * English only, and that is a real limitation rather than an oversight:
 * Coresignal's title field for this market is overwhelmingly English even when
 * the person works in Arabic. Arabic title terms return almost nothing, so
 * adding them would widen the query without widening the result.
 */
export const DECISION_TITLES = [
  "Chief", "CEO", "CFO", "CTO", "CIO", "COO", "Chief Executive",
  "President", "Vice President", "VP", "Managing Director",
  "Head of", "Director", "General Manager", "Partner",
] as const;

/**
 * The starting universe per cluster: real Saudi institutions, by name and site.
 *
 * Seeded rather than discovered. `docs/03-design-review.md` §8 is explicit that
 * the global data layer's Saudi sector coverage is thin, so letting a vendor
 * sector filter define the cluster would build the map out of exactly the data
 * that was judged too weak to rely on. A person curates this, and the AM
 * console edits it.
 *
 * No Coresignal id here. Resolving name/site to an id is a *free* company
 * search, done on first run and cached on the row, so seeding cannot bake in a
 * vendor identifier that might be wrong and would never be re-checked.
 */
export const SEED_COMPANIES: Record<ClusterSlug, { name: string; website: string }[]> = {
  banking: [
    { name: "Al Rajhi Bank", website: "alrajhibank.com.sa" },
    { name: "Saudi National Bank", website: "alahli.com" },
    { name: "Riyad Bank", website: "riyadbank.com" },
    { name: "Saudi Awwal Bank", website: "sab.com" },
    { name: "Banque Saudi Fransi", website: "alfransi.com.sa" },
    { name: "Arab National Bank", website: "anb.com.sa" },
    { name: "Alinma Bank", website: "alinma.com" },
    { name: "Bank Albilad", website: "bankalbilad.com" },
    { name: "stc pay", website: "stcpay.com.sa" },
    { name: "Tamara", website: "tamara.co" },
    { name: "Tabby", website: "tabby.ai" },
    { name: "Lean Technologies", website: "leantech.me" },
    { name: "Geidea", website: "geidea.net" },
    { name: "Moyasar", website: "moyasar.com" },
  ],
  insurance: [
    { name: "Bupa Arabia", website: "bupa.com.sa" },
    { name: "Tawuniya", website: "tawuniya.com" },
    { name: "Al Rajhi Takaful", website: "alrajhitakaful.com" },
    { name: "Medgulf", website: "medgulf.com.sa" },
    { name: "Walaa Insurance", website: "walaa.com" },
    { name: "Malath Insurance", website: "malath.com.sa" },
    { name: "Rasan", website: "rasan.com.sa" },
  ],
  public: [
    { name: "NEOM", website: "neom.com" },
    { name: "Roshn", website: "roshn.sa" },
    { name: "Qiddiya", website: "qiddiya.com" },
    { name: "Diriyah Company", website: "diriyah.sa" },
    { name: "Red Sea Global", website: "redseaglobal.com" },
    { name: "Public Investment Fund", website: "pif.gov.sa" },
    { name: "SDAIA", website: "sdaia.gov.sa" },
    { name: "Monsha'at", website: "monshaat.gov.sa" },
    { name: "Saudi Post", website: "splonline.com.sa" },
  ],
  energy: [
    { name: "Saudi Aramco", website: "aramco.com" },
    { name: "SABIC", website: "sabic.com" },
    { name: "Ma'aden", website: "maaden.com.sa" },
    { name: "ACWA Power", website: "acwapower.com" },
    { name: "Saudi Electricity Company", website: "se.com.sa" },
    { name: "Bahri", website: "bahri.sa" },
    { name: "Mawani", website: "mawani.gov.sa" },
  ],
  health: [
    { name: "Dr. Sulaiman Al Habib", website: "hmg.com" },
    { name: "Mouwasat Medical Services", website: "mouwasat.com" },
    { name: "Dallah Health", website: "dallah-hospital.com" },
    { name: "Nahdi Medical", website: "nahdionline.com" },
    { name: "Al Borg Diagnostics", website: "alborglaboratories.com" },
  ],
  enterprise: [
    { name: "stc", website: "stc.com.sa" },
    { name: "Mobily", website: "mobily.com.sa" },
    { name: "Zain KSA", website: "sa.zain.com" },
    { name: "Elm", website: "elm.sa" },
    { name: "Thiqah", website: "thiqah.sa" },
    { name: "Tawal", website: "tawal.com.sa" },
    { name: "solutions by stc", website: "solutions.com.sa" },
  ],
};
