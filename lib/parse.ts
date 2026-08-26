export interface ParsedRow {
  latin: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  email?: string;
  why?: string;
}

/** Accepts tab/comma-separated rows or bare LinkedIn URLs, one per line. */
export function parseRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/linkedin\.com\/in\//i.test(line) && !/[\t,]/.test(line)) {
      const slug = line.split("/in/")[1]?.replace(/\/.*$/, "") ?? line;
      rows.push({
        latin: slug.replace(/[-_]+/g, " ").toUpperCase(),
        title: "—",
        company: "—",
        linkedinUrl: line.replace(/^https?:\/\//, ""),
      });
      continue;
    }
    const cells = line
      .split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2) continue;
    if (/^(name|full name|الاسم)$/i.test(cells[0])) continue; // header row
    rows.push({
      latin: cells[0],
      title: cells[1] || "—",
      company: cells[2] || "—",
      linkedinUrl: cells.find((c) => /linkedin\.com/i.test(c)),
      email: cells.find((c) => /@/.test(c)),
      why: cells[5],
    });
  }
  return rows;
}
