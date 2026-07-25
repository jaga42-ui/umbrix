import Link from "next/link";
import { CITIES } from "@/lib/seoCities";
import { fieldLabel } from "@/lib/seoFields";

/**
 * Internal links to every city page for a given field (e.g. all "fresher IT
 * jobs in <city>" pages). Rendered on the field page and each city page so
 * crawlers can reach the whole field×city set. `currentCity` bolds the active one.
 */
export function CityLinks({ field, currentCity }: { field: string; currentCity?: string }) {
  return (
    <nav aria-label={`${fieldLabel(field)} jobs by city`} className="border-t border-border pt-8">
      <h2 className="font-serif text-lg tracking-tight mb-4">{fieldLabel(field)} jobs by city</h2>
      <ul className="flex flex-wrap gap-2">
        {CITIES.map((c) => {
          const active = c.slug === currentCity;
          return (
            <li key={c.slug}>
              <Link
                href={`/jobs/${field}/${c.slug}`}
                aria-current={active ? "page" : undefined}
                className={`inline-block text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-secondary text-foreground border-border font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
