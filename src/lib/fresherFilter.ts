/**
 * The one definition of "fresher-eligible" the public surfaces query by.
 *
 * ## The defect this exists to fix
 *
 * Every fresher surface used to filter on `minExperience: { $not: { $gte: 2 } }`.
 * That matches a stated 0 or 1 — and it also matches **unstated**, because
 * `$not` is true for a missing field. Unstated is not evidence of anything, so
 * a role no source ever labelled sailed through as a fresher job.
 *
 * Measured on production: of 4,315 postings published as fresher-eligible, only
 * 1,100 stated an experience level. 1,352 carried an outright senior title —
 * "Senior Product Manager", "Staff Engineer", "City Supply Head". Nearly a third
 * of every page promising a fresher job was showing something else, which is a
 * direct breach of the product's core promise.
 *
 * CLAUDE.md names this exact failure as a past incident. It stayed live because
 * the filter was copy-pasted across five call sites with no shared definition —
 * the same drift that hid a source behind a hardcoded list in `fieldSlugConds`.
 * Hence one module, imported everywhere.
 *
 * ## The rule
 *
 * A posting is fresher-eligible when it is not senior-level AND either:
 *   1. it *states* an experience level of 0 or 1 — real evidence, authoritative; or
 *   2. it states nothing, but its title doesn't read as senior; or
 *   3. its title reads senior but also carries an explicit fresher signal
 *      ("Junior Architect", "Product Manager-Trainee", "Account Manager Intern").
 *
 * Rules 1 and 3 are not decoration. Without rule 1, 46 postings that state
 * `minExperience: 0` would be dropped for having "Architect" or "Staff" in the
 * title — discarding real evidence in favour of a guess. Without rule 3, 16
 * unambiguously-junior titles would go with them.
 *
 * ## Why the title heuristic is a floor, not a ceiling
 *
 * This removes what is *provably* wrong. It does not make the remaining
 * unstated postings verified — a plain "Software Engineer" needing three years
 * still passes. The real fix is the LLM eligibility pass filling `minExperience`
 * in; requiring a stated value today would cut the surface from 4,315 to 1,100
 * (-74.5%), which is a product call, not a bug fix.
 *
 * The patterns come from `@umbrix/eligibility` rather than being redeclared, so
 * the ingest pipeline and the pages it feeds can never disagree about what
 * "senior" means — the same reasoning `jobFreshness.ts` uses for its thresholds.
 */
import { SENIOR_TITLE_RE, FRESHER_TITLE_RE } from "@umbrix/eligibility";

/**
 * Mongo conditions that together mean "fresher-eligible".
 *
 * Returned as an array to spread into `$and`, because callers already use `$or`
 * for field scoping and one document can only carry a single `$or` key:
 *
 * ```ts
 * const query = {
 *   status: "Active",
 *   isIndia: true,
 *   $and: [...fresherEligibleConditions(), { $or: fieldSlugConds(field) }],
 * };
 * ```
 *
 * The title regexes are unindexed, so this adds a scan over the candidate set.
 * At the current ~6k active India postings that is immaterial; if the collection
 * grows an order of magnitude, materialize the verdict at ingest instead.
 */
export function fresherEligibleConditions(): Record<string, unknown>[] {
  return [
    // Never a stated mid/senior requirement.
    { minExperience: { $not: { $gte: 2 } } },
    {
      $or: [
        // 1. Stated evidence wins outright — `$ne: null` also excludes missing.
        { minExperience: { $ne: null, $lte: 1 } },
        // 2. Nothing stated, and the title doesn't read senior.
        { title: { $not: SENIOR_TITLE_RE } },
        // 3. Senior-ish title rescued by an explicit fresher signal.
        { title: FRESHER_TITLE_RE },
      ],
    },
  ];
}

/**
 * The same rule as an in-memory predicate, for callers that already hold the
 * document (and so the unit tests can pin the logic without a database).
 *
 * Kept structurally parallel to `fresherEligibleConditions` on purpose: the two
 * must agree, and the cheapest way to keep them agreeing is for them to read
 * the same way.
 */
export function isFresherEligible(job: {
  minExperience?: number | null;
  title?: string | null;
}): boolean {
  const stated = typeof job.minExperience === "number" ? job.minExperience : null;

  // Never a stated mid/senior requirement.
  if (stated !== null && stated >= 2) return false;

  // 1. Stated evidence wins outright.
  if (stated !== null && stated <= 1) return true;

  const title = String(job.title ?? "");
  // 2 / 3. Nothing stated: fall back to the title, with a fresher signal
  // overriding a senior-looking one.
  return !SENIOR_TITLE_RE.test(title) || FRESHER_TITLE_RE.test(title);
}
