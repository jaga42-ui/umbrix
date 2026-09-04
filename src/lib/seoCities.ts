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

/**
 * Below this many matching jobs, a city page is too thin to index (noindex).
 *
 * Raised from 4 to 25 deliberately, and it de-indexes roughly two thirds of the
 * location matrix: 175 city pages qualified at 4, about 56 do at 25. That is the
 * point. The SEO quality gate warns at 30 location pages and hard-stops at 50,
 * and the pages themselves were measured at 91% identical prose even after the
 * hiring-snapshot work — there is not enough populated per-city data to write
 * 60% unique copy today, so the honest lever is to publish fewer pages rather
 * than more thin ones. The shallowest pages qualifying at 4 carried literally
 * four listings each ("healthcare/indore", "teaching/kochi").
 *
 * Nothing is deleted: a de-indexed city page still renders and is still linked
 * from CityLinks, so a visitor who wants Indore healthcare roles still finds
 * them. It simply stops asking Google to index a page with nothing distinct to
 * say. Lower this again once per-city content has real substance behind it —
 * salary bands and batch/branch mix, which are 0% populated today.
 */
export const MIN_CITY_JOBS_TO_INDEX = 25;

/**
 * The same rule for nationwide field pages, which is deliberately NOT the city
 * threshold.
 *
 * `/internships/logistics` is one page covering all of India, not one of 185
 * near-identical location pages, so the doorway reasoning above does not apply
 * to it. Before this split both used a single constant, and raising that
 * constant would have silently de-indexed nationwide internship hubs holding
 * 4-24 listings — a side effect nobody asked for. Kept at the original 4.
 */
export const MIN_FIELD_JOBS_TO_INDEX = 4;
