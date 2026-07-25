/**
 * Indian cities we build /jobs/<field>/<city> SEO pages for. `pattern` matches
 * the free-text `location` string on jobs (which looks like "Bengaluru,
 * Karnataka"), folding in the common alt-spellings. Pure module — shared by the
 * pages and the sitemap.
 */
export interface City {
  slug: string;
  label: string;
  pattern: string; // regex source, matched case-insensitively against location
}

export const CITIES: City[] = [
  { slug: "bengaluru", label: "Bengaluru", pattern: "bengaluru|bangalore" },
  { slug: "delhi", label: "Delhi", pattern: "\\bnew delhi\\b|\\bdelhi\\b" },
  { slug: "mumbai", label: "Mumbai", pattern: "\\bmumbai\\b|navi mumbai" },
  { slug: "pune", label: "Pune", pattern: "\\bpune\\b" },
  { slug: "hyderabad", label: "Hyderabad", pattern: "\\bhyderabad\\b" },
  { slug: "chennai", label: "Chennai", pattern: "\\bchennai\\b" },
  { slug: "gurgaon", label: "Gurgaon", pattern: "gurgaon|gurugram" },
  { slug: "noida", label: "Noida", pattern: "\\bnoida\\b" },
  { slug: "kolkata", label: "Kolkata", pattern: "\\bkolkata\\b" },
  { slug: "ahmedabad", label: "Ahmedabad", pattern: "\\bahmedabad\\b" },
  { slug: "jaipur", label: "Jaipur", pattern: "\\bjaipur\\b" },
  { slug: "kochi", label: "Kochi", pattern: "kochi|cochin" },
  { slug: "chandigarh", label: "Chandigarh", pattern: "\\bchandigarh\\b" },
  { slug: "coimbatore", label: "Coimbatore", pattern: "\\bcoimbatore\\b" },
  { slug: "indore", label: "Indore", pattern: "\\bindore\\b" },
];

const BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

export function cityBySlug(slug: string): City | undefined {
  return BY_SLUG[slug];
}

/** Below this many matching jobs, a city page is too thin to index (noindex). */
export const MIN_CITY_JOBS_TO_INDEX = 4;
