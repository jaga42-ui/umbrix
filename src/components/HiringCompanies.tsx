import { Building2 } from "lucide-react";
import { selectHiringCompanies, type HiringCompany } from "@/lib/citySnapshot";

/**
 * "Which companies are hiring freshers here?" — answered with live counts.
 *
 * Searchers arrive on city pages with queries like "it companies in pune for
 * freshers": they want employers, not a job list. This states which employers
 * have fresher openings in the slice and how many, from an exact Mongo count.
 *
 * Which employers get named is `selectHiringCompanies`; the rest become a count.
 * Renders nothing below two companies — a "list" of one employer answers no
 * question and reads as padding. Server-rendered, so it needs no loading state
 * and is identical for guests and signed-in users.
 */
export function HiringCompanies({
  companies,
  place,
  fieldInline,
  noun = "roles",
}: {
  /** Every employer in the slice, ranked — `rankHiringCompanies` output. */
  companies: HiringCompany[];
  /** "Bengaluru". */
  place: string;
  /** Lower-case field label, e.g. "IT & software". */
  fieldInline: string;
  /** Plural noun for an opening — "roles" or "internships". */
  noun?: string;
}) {
  if (companies.length < 2) return null;
  const { shown, more } = selectHiringCompanies(companies);
  const restAreSingles = companies.slice(shown.length).every((c) => c.roles === 1);

  const heading = `${fieldInline.charAt(0).toUpperCase()}${fieldInline.slice(1)} companies hiring freshers in ${place}`;
  const singular = noun.endsWith("s") ? noun.slice(0, -1) : noun;

  return (
    <section aria-labelledby="hiring-companies-heading" className="mb-10">
      <h2
        id="hiring-companies-heading"
        className="text-lg font-bold tracking-tight mb-1"
        style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
      >
        {heading}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Ranked by how many live fresher {noun} each one has open on Umbrix. Every listing is scam-checked.
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {shown.map((c) => (
          <li
            key={c.name}
            className="flex items-center justify-between gap-3 border border-border rounded-none px-4 py-3"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 shrink-0 text-muted-foreground/70" aria-hidden />
              <span className="font-medium truncate">{c.name}</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground shrink-0 tabular-nums">
              {c.roles.toLocaleString("en-IN")} open {c.roles === 1 ? singular : noun}
            </span>
          </li>
        ))}
      </ol>
      {more > 0 && (
        <p className="text-sm text-muted-foreground mt-3">
          Plus {more.toLocaleString("en-IN")} more {more === 1 ? "company" : "companies"}
          {restAreSingles ? ` with one opening ${more === 1 ? "" : "each"}`.trimEnd() : " hiring freshers here"}.
        </p>
      )}
    </section>
  );
}
