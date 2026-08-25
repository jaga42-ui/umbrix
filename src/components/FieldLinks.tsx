import Link from "next/link";
import { SEO_FIELDS, fieldLabel } from "@/lib/seoFields";

/**
 * Internal-link block listing every field landing page. Reused on the /jobs hub
 * and each /jobs/<field> page so crawlers can reach them all and link equity
 * spreads across the set. `current` bolds the active field.
 *
 * `basePath` and `heading` let /internships reuse this without a parallel copy;
 * both default to the /jobs wording so existing call sites are unchanged.
 */
export function FieldLinks({
  current,
  basePath = "/jobs",
  heading = "Fresher jobs by field",
}: {
  current?: string;
  basePath?: string;
  heading?: string;
}) {
  return (
    <nav aria-label={heading} className="border-t border-border pt-8">
      <h2 className="font-serif text-lg tracking-tight mb-4">{heading}</h2>
      <ul className="flex flex-wrap gap-2">
        {SEO_FIELDS.map((f) => {
          const active = f === current;
          return (
            <li key={f}>
              <Link
                href={`${basePath}/${f}`}
                aria-current={active ? "page" : undefined}
                className={`inline-block text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-secondary text-foreground border-border font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {fieldLabel(f)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
