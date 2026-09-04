import { toProseList, type CitySnapshot as Snapshot } from "@/lib/citySnapshot";

/**
 * The one block on a field or city page whose text is genuinely that slice's.
 *
 * Everything else on these ~300 pages is a template with the place name swapped
 * in — measured at 92-96% identical prose between two same-field city pages.
 * This block states facts that actually differ: which skills the live listings
 * ask for, who is hiring, how much moved this week. Measured across six cities,
 * the top-five skill lists overlap by ~2/6 and the employer lists barely at all.
 *
 * Every clause is omitted when its data is missing rather than rendering an
 * empty label, so a thin slice prints a short honest paragraph instead of
 * "Most-requested skills:" followed by nothing.
 */
export function CitySnapshot({
  snapshot,
  place,
  fieldInline,
  noun = "roles",
}: {
  snapshot: Snapshot;
  /** "Bengaluru", or "India" on a nationwide field page. */
  place: string;
  /** Lower-case field label, e.g. "IT & software". */
  fieldInline: string;
  noun?: string;
}) {
  const { total, addedLastWeek, internships, skills, employers } = snapshot;
  if (total === 0) return null;

  const count = total.toLocaleString("en-IN");
  const hasSkills = skills.length > 0;
  const hasEmployers = employers.length > 0;

  return (
    <section
      aria-labelledby="snapshot-heading"
      className="border border-border rounded-none p-5 sm:p-6 mb-10"
      style={{ background: "var(--um-surface, transparent)" }}
    >
      <h2
        id="snapshot-heading"
        className="text-lg font-bold tracking-tight mb-3"
        style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
      >
        What&rsquo;s hiring in {place} right now
      </h2>

      {/* Assembled as one string, not JSX fragments: a newline between
          expressions renders as a literal space, which put a gap before every
          comma ("in Bengaluru , 62 of them"). */}
      <p className="text-muted-foreground leading-relaxed mb-4">
        {[
          `${count} live ${fieldInline} ${noun} in ${place}`,
          addedLastWeek > 0
            ? `, ${addedLastWeek.toLocaleString("en-IN")} of them added in the last seven days`
            : "",
          internships > 0
            ? `, and ${internships.toLocaleString("en-IN")} ${
                internships === 1 ? "is an internship" : "are internships"
              }`
            : "",
          ".",
        ].join("")}{" "}
        {hasSkills && (
          <>
            The skills mentioned most often across these listings are{" "}
            <strong style={{ color: "var(--um-text)" }}>{toProseList(skills)}</strong>.{" "}
          </>
        )}
        {hasEmployers && <>Employers hiring here right now include {toProseList(employers)}.</>}
      </p>

      <dl className="grid grid-cols-3 gap-3 sm:gap-4 font-mono text-xs">
        <div>
          <dt className="text-muted-foreground mb-1">Live now</dt>
          <dd className="text-xl font-bold tabular-nums" style={{ color: "var(--um-text)" }}>
            {count}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Added this week</dt>
          <dd className="text-xl font-bold tabular-nums" style={{ color: "var(--um-text)" }}>
            {addedLastWeek.toLocaleString("en-IN")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Internships</dt>
          <dd className="text-xl font-bold tabular-nums" style={{ color: "var(--um-text)" }}>
            {internships.toLocaleString("en-IN")}
          </dd>
        </div>
      </dl>
    </section>
  );
}
