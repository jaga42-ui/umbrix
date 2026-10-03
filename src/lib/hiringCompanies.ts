import { connectToDatabase } from "@/lib/mongodb";
import { Opportunity } from "@/models/Opportunity";
import { sectionQuery, type SeoSection } from "@/lib/seoSection";
import { rankHiringCompanies, type CompanyGroup, type HiringCompany } from "@/lib/citySnapshot";

/**
 * Exact fresher-opening counts per employer in one section+field+city slice,
 * for the "companies hiring freshers" block on the city pages.
 *
 * Grouped in Mongo rather than counted from the 300-row snapshot sample: a page
 * that says "12 open roles" has to be right, and on the large slices the sample
 * covers only the newest few hundred postings. The section query is plain
 * strings, numbers and regexes, so `aggregate` — which skips Mongoose casting —
 * matches exactly what `find` does. Ranking is the pure `rankHiringCompanies`.
 *
 * Returns [] on any failure: the section is additive, and a missing list must
 * never take the page down with it.
 */
export async function getHiringCompanies(
  section: SeoSection,
  field: string,
  cityPattern: string
): Promise<HiringCompany[]> {
  try {
    const db = await connectToDatabase();
    if (!db) return [];
    const groups = await Opportunity.aggregate<CompanyGroup>([
      { $match: sectionQuery(section, field, cityPattern) },
      { $group: { _id: { name: "$companyName", slug: "$companySlug" }, roles: { $sum: 1 } } },
    ]);
    return rankHiringCompanies(groups);
  } catch {
    return [];
  }
}
