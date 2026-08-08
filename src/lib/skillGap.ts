/**
 * Skill-gap analysis grounded in live job inventory.
 *
 * Generic résumé tools score a document against style rules. They cannot tell a
 * candidate what the market is actually asking for, because they have no job
 * index. Umbrix does — 21,000 active listings — so the advice here is not "add
 * more keywords" but "SQL appears in 340 fresher roles you otherwise qualify
 * for, and you don't list it".
 *
 * That framing is the difference between generic and worth paying for, and it
 * is honest: every number is a count of real open listings, computed at the
 * moment of the request. Nothing is projected, estimated or invented.
 *
 * Pure function — the caller supplies the jobs, so this is fully testable
 * without a database.
 */

export interface MarketJob {
  /** Skill/category tags attached to the listing by the ingest pipeline. */
  tags?: string[];
}

export interface SkillOpportunity {
  skill: string;
  /** Listings in the sample that ask for this skill and that the user lacks. */
  jobsUnlocked: number;
  /** Share of the sampled market asking for it, 0–100. */
  marketShare: number;
}

export interface SkillGapReport {
  /** Listings analysed. */
  sampleSize: number;
  /** Listings matching at least one of the user's skills. */
  reachable: number;
  /** Share of the market the user's current skills reach, 0–100. */
  coverage: number;
  /** Highest-leverage additions, most listings first. */
  opportunities: SkillOpportunity[];
  /** The user's skills that the market actually asks for, most in demand first. */
  validatedSkills: { skill: string; demand: number }[];
}

/** Aliases so "JS" and "JavaScript" are not counted as different skills. */
const ALIASES: Record<string, string> = {
  js: "javascript", ts: "typescript", "node": "node.js", nodejs: "node.js",
  reactjs: "react", "react.js": "react", nextjs: "next.js", postgres: "postgresql",
  k8s: "kubernetes", ml: "machine learning", ai: "artificial intelligence",
  gcp: "google cloud", "c#": "c sharp", golang: "go",
};

function canonical(skill: string): string {
  const s = String(skill ?? "").trim().toLowerCase();
  return ALIASES[s] ?? s;
}

/** Tags that describe a job category rather than a learnable skill. */
const NON_SKILL_TAGS = new Set([
  "it", "engineering", "finance", "marketing", "sales", "hr", "customer-service",
  "logistics", "healthcare", "teaching", "hospitality", "admin", "consultancy",
  "creative", "manufacturing", "retail", "graduate", "government", "internship",
  "scholarship", "general", "frontend", "backend", "fullstack",
]);

/**
 * Compare a candidate's skills against what a slice of the live market asks for.
 *
 * @param userSkills - Skills extracted from the résumé.
 * @param jobs - Active listings the candidate is plausibly eligible for.
 * @param limit - How many opportunities to return.
 */
export function analyzeSkillGap(userSkills: string[], jobs: MarketJob[], limit = 5): SkillGapReport {
  const owned = new Set(userSkills.map(canonical).filter(Boolean));

  const demand = new Map<string, number>();       // skill -> listings asking for it
  const unlocked = new Map<string, number>();     // skill -> listings the user does NOT already reach
  let reachable = 0;

  for (const job of jobs) {
    const tags = (job.tags ?? []).map(canonical).filter((t) => t && !NON_SKILL_TAGS.has(t));
    if (tags.length === 0) continue;

    const unique = new Set(tags);
    const matchesUser = [...unique].some((t) => owned.has(t));
    if (matchesUser) reachable++;

    for (const tag of unique) {
      demand.set(tag, (demand.get(tag) ?? 0) + 1);
      // Only count a skill as "unlocking" a listing the user cannot already
      // reach — otherwise every popular skill looks like a win on jobs they
      // already qualify for, which would overstate the benefit.
      if (!matchesUser && !owned.has(tag)) {
        unlocked.set(tag, (unlocked.get(tag) ?? 0) + 1);
      }
    }
  }

  const sampleSize = jobs.length;
  const opportunities: SkillOpportunity[] = [...unlocked.entries()]
    .filter(([skill]) => !owned.has(skill))
    .map(([skill, jobsUnlocked]) => ({
      skill,
      jobsUnlocked,
      marketShare: sampleSize > 0 ? Math.round(((demand.get(skill) ?? 0) / sampleSize) * 100) : 0,
    }))
    // Ties broken by name so the same input always produces the same report.
    .sort((a, b) => b.jobsUnlocked - a.jobsUnlocked || a.skill.localeCompare(b.skill))
    .slice(0, limit);

  const validatedSkills = [...owned]
    .map((skill) => ({ skill, demand: demand.get(skill) ?? 0 }))
    .filter((s) => s.demand > 0)
    .sort((a, b) => b.demand - a.demand || a.skill.localeCompare(b.skill))
    .slice(0, limit);

  return {
    sampleSize,
    reachable,
    coverage: sampleSize > 0 ? Math.round((reachable / sampleSize) * 100) : 0,
    opportunities,
    validatedSkills,
  };
}
