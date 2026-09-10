import type { radarSignals } from "@/lib/db/schema";
import type { Lang } from "./RadarChrome";

type Item = typeof radarSignals.$inferSelect;

/**
 * An issue's items.
 *
 * Every row renders its evidence link, because a claim about a named executive
 * without a source is exactly what this product argues against on its own
 * landing page. The database will not store an approved row without evidence,
 * so there is no case here where a name appears with nothing behind it.
 */
export function IssueBody({ items, lang }: { items: Item[]; lang: Lang }) {
  const ar = lang === "ar";
  return (
    <div className="stack g12">
      {items.map((item) => {
        const source = item.evidence[0];
        return (
          <div className="card stack g8" key={item.id}>
            <div className="row g12 wrapx">
              <span className={`badge${item.kind === "arrival" ? " accent" : ""}`}>
                {item.kind === "arrival"
                  ? ar ? "التحاق" : "Arrival"
                  : ar ? "مغادرة" : "Departure"}
              </span>
              <strong className="grow">{item.personName}</strong>
            </div>
            <span className="sm muted">{item.personTitle}</span>
            {(ar ? item.noteAr : item.noteEn) && (
              <p className="sm">{ar ? item.noteAr : item.noteEn}</p>
            )}
            {source?.url ? (
              <a className="xs lat" href={source.url} rel="nofollow noopener noreferrer" target="_blank">
                {source.title || source.url} · {source.date}
              </a>
            ) : (
              <span className="xs dim">
                {source?.title} · {source?.date}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
