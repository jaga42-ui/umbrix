/**
 * Personalized match scoring for the Discovery Feed.
 *
 * Produces a transparent, heuristic 0–99 compatibility score for a job given a
 * user's profile. Intentionally NOT ML (see PRD non-goals) — every point is
 * explainable, which is what powers the per-card "why this matched" copy.
 *
 * Signals, in order of weight:
 *   1. Skill overlap   — how many of the job's tags the user actually has.
 *   2. Domain alignment — frontend / backend / data / design / etc. overlap
 *      between the user's title + past roles and the job title.
 *   3. Seniority fit   — how close the job's level is to the user's level.
 *   4. Description hits — user skills mentioned in the body beyond the tags.
 */

export interface MatchProfile {
  skills: string[];
  title?: string;
  experience?: { role?: string; company?: string }[];
  /** The field(s) the candidate is targeting (from JOB_FIELDS). Drives cross-field relevance. */
  targetFields?: string[];
}

export interface JobLike {
  title: string;
  tags: string[];
  descriptionHtml?: string;
  /** Minimum years of experience the posting requires (0 = fresher-eligible). */
  minExperience?: number | null;
  /** The job's field (from JOB_FIELDS), e.g. "it", "sales". Usually derived from its source. */
  field?: string;
}

/**
 * Coarse field taxonomy shared by jobs and profiles — the primary cross-field
 * relevance signal now that inventory spans every field (not just tech). Mirrors
 * the Adzuna category shards; ATS boards map to "it".
 */
export const JOB_FIELDS = [
  "it", "engineering", "sales", "marketing", "finance", "customer-service",
  "hr", "admin", "retail", "logistics", "healthcare", "teaching",
  "hospitality", "creative", "consultancy", "manufacturing", "graduate", "general",
] as const;

/**
 * Derive a job's field from its company slug — Adzuna shards are named
 * `adzuna-in-<field>`; every other source is an ATS board (overwhelmingly
 * software/product), which maps to "it".
 */
export function jobFieldFromSlug(companySlug: string): string {
  const prefix = "adzuna-in-";
  return companySlug.startsWith(prefix) ? companySlug.slice(prefix.length) : "it";
}

export interface MatchResult {
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  matchSummary: string;
  matchExplanation: string[];
}

// Point budget (sums well under 99 so strong-but-imperfect matches leave headroom).
const BASE = 55;
const SKILL_MAX = 30; // scaled by ratio of matched tags
const SKILL_COUNT_BONUS_MAX = 3; // reward absolute breadth of overlap
const DOMAIN_BONUS_PER_HIT = 4;
const DOMAIN_BONUS_MAX = 8;
const SENIORITY_EXACT = 6;
const SENIORITY_NEAR = 3;
const DESC_BONUS_MAX = 3;
// Fresher eligibility — UMBRIX's audience is freshers, so open roles rank up and
// experience-heavy roles rank down.
const FRESHER_BONUS = 8; // minExperience 0
const JUNIOR_BONUS = 4; // minExperience 1
const EXPERIENCED_PENALTY = 8; // minExperience >= 3
// Field alignment — the dominant cross-field signal. A job in the user's field
// ranks well above one outside it, so an all-field feed surfaces the right roles.
const FIELD_MATCH_BONUS = 12;
const FIELD_MISMATCH_PENALTY = 16;
const SCORE_CAP = 99;

// Domain/discipline keywords used for role alignment. Kept broad but meaningful;
// generic words like "engineer"/"developer" are deliberately excluded (they carry
// no discriminating signal) — seniority is handled separately.
const DOMAIN_KEYWORDS = [
  "frontend", "front-end", "front end",
  "backend", "back-end", "back end",
  "fullstack", "full-stack", "full stack",
  "product", "design", "designer", "ux", "ui",
  "data", "machine learning", "ml", "ai",
  "mobile", "ios", "android",
  "platform", "infrastructure", "infra", "devops", "sre",
  "security", "qa", "test",
  "cloud", "embedded", "game", "web3", "blockchain",
  "growth", "analytics", "developer relations", "devrel",
];

/** Rough seniority ladder derived from a title string. 3 == mid (default). */
function seniorityRank(text: string): number {
  const t = ` ${text.toLowerCase()} `;
  if (/intern/.test(t)) return 1;
  if (/(junior|\bjr\b|entry|associate|\bgrad\b|graduate)/.test(t)) return 2;
  if (/(principal|staff|\blead\b|architect|director|head of|\bvp\b|vice president|chief)/.test(t)) return 5;
  if (/(senior|\bsr\b|sr\.)/.test(t)) return 4;
  return 3;
}

function domainKeywordsIn(text: string): Set<string> {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const kw of DOMAIN_KEYWORDS) {
    if (lower.includes(kw)) found.add(normalizeDomain(kw));
  }
  return found;
}

// Collapse synonyms so "front-end" and "frontend" count as one hit.
function normalizeDomain(kw: string): string {
  const k = kw.replace(/[-\s]/g, "");
  if (k === "frontend") return "frontend";
  if (k === "backend") return "backend";
  if (k === "fullstack") return "fullstack";
  if (k === "machinelearning" || k === "ml" || k === "ai") return "ml/ai";
  if (k === "designer" || k === "design" || k === "ux" || k === "ui") return "design";
  if (k === "infrastructure" || k === "infra" || k === "devops" || k === "sre" || k === "platform") return "platform";
  if (k === "developerrelations" || k === "devrel") return "devrel";
  return k;
}

/**
 * When the user has no skills yet (no resume parsed), return a neutral baseline.
 * This makes the feed fall back to recency order and nudges a resume upload —
 * the personalization is the upsell.
 */
function neutralResult(jobTags: string[]): MatchResult {
  return {
    score: 70,
    matchingSkills: [],
    missingSkills: jobTags,
    matchSummary: "Baseline match. Upload a resume to calculate your exact fit.",
    matchExplanation: [
      "Baseline match score. Upload a resume to calculate your exact fit.",
      `This role actively uses: ${jobTags.slice(0, 4).join(", ")}.`,
    ],
  };
}

export function calculateMatch(profile: MatchProfile, job: JobLike): MatchResult {
  const skills = profile.skills ?? [];
  const jobTags = job.tags ?? [];

  if (skills.length === 0) {
    return neutralResult(jobTags);
  }

  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  const matchingSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const tag of jobTags) {
    if (skillSet.has(tag.toLowerCase())) matchingSkills.push(tag);
    else missingSkills.push(tag);
  }

  let score = BASE;

  // 1. Skill overlap (ratio-weighted) + a small breadth bonus.
  const ratio = jobTags.length > 0 ? matchingSkills.length / jobTags.length : 0;
  score += Math.round(ratio * SKILL_MAX);
  score += Math.min(matchingSkills.length, SKILL_COUNT_BONUS_MAX);

  // 2. Domain alignment between the user's background and the job title.
  const userBackground = [profile.title ?? "", ...(profile.experience ?? []).map((e) => e?.role ?? "")].join(" ");
  const userDomains = domainKeywordsIn(userBackground);
  const jobDomains = domainKeywordsIn(job.title);
  const sharedDomains = [...jobDomains].filter((d) => userDomains.has(d));
  if (sharedDomains.length > 0) {
    score += Math.min(sharedDomains.length * DOMAIN_BONUS_PER_HIT, DOMAIN_BONUS_MAX);
  }

  // 3. Seniority fit (only when we know the user's level).
  let seniorityNote: string | null = null;
  if (profile.title) {
    const userRank = seniorityRank(userBackground);
    const jobRank = seniorityRank(job.title);
    const diff = Math.abs(userRank - jobRank);
    if (diff === 0) {
      score += SENIORITY_EXACT;
      seniorityNote = "Seniority fit: this role matches your level.";
    } else if (diff === 1) {
      score += SENIORITY_NEAR;
      seniorityNote = "Close seniority match for your experience.";
    } else if (userRank > jobRank) {
      seniorityNote = "This role may sit below your current level.";
    } else {
      seniorityNote = "A stretch role above your current level.";
    }
  }

  // 4. Skills mentioned in the description beyond the tags.
  const desc = (job.descriptionHtml ?? "").toLowerCase();
  if (desc) {
    let descHits = 0;
    for (const skill of skills) {
      const s = skill.toLowerCase();
      if (!skillSet.has(s)) continue;
      if (matchingSkills.some((m) => m.toLowerCase() === s)) continue; // already counted via tags
      if (desc.includes(s)) descHits++;
    }
    if (descHits > 0) score += Math.min(descHits, DESC_BONUS_MAX);
  }

  // 5. Fresher eligibility — the audience is freshers, so open roles rank up and
  // experience-heavy roles rank down. Unknown (null) stays neutral.
  let eligibilityNote: string | null = null;
  const minExp = job.minExperience;
  if (minExp != null) {
    if (minExp <= 0) {
      score += FRESHER_BONUS;
      eligibilityNote = "Fresher-friendly: open to freshers / no experience required.";
    } else if (minExp === 1) {
      score += JUNIOR_BONUS;
      eligibilityNote = "Junior-friendly: about a year of experience.";
    } else if (minExp >= 3) {
      score -= EXPERIENCED_PENALTY;
      eligibilityNote = `Needs ~${minExp}+ years experience — a stretch for a fresher.`;
    }
  }

  // 6. Field alignment — the dominant cross-field signal. A role in the user's
  // target field ranks well above one outside it, so an all-field feed surfaces
  // roles that actually fit the candidate's background.
  // "general"/"graduate" are cross-field entry-level catch-alls — never penalize them.
  const CROSS_FIELD = job.field === "general" || job.field === "graduate";
  const inField = Boolean(job.field && profile.targetFields?.includes(job.field));
  const fieldKnown = Boolean(job.field && profile.targetFields && profile.targetFields.length > 0);
  if (fieldKnown) {
    if (inField) score += FIELD_MATCH_BONUS;
    else if (!CROSS_FIELD) score -= FIELD_MISMATCH_PENALTY;
  }
  const fieldLabel = job.field ? job.field.replace(/-/g, " ") : "";

  score = Math.max(0, Math.min(score, SCORE_CAP));

  // Build the human-readable explanation shown on each card. Opener priority:
  // matched skills > in-field relevance > adjacency (so non-tech in-field roles,
  // which rarely have skill tags, still get a meaningful "why").
  const explanation: string[] = [];
  if (matchingSkills.length > 0) {
    explanation.push(`Strong match: you have ${matchingSkills.slice(0, 3).join(", ")}.`);
  } else if (inField) {
    explanation.push(`In your field: a ${fieldLabel} role that fits your background.`);
  } else {
    explanation.push("Adjacent match: your profile is close but shares no exact tags with this role.");
  }
  if (sharedDomains.length > 0) {
    explanation.push(`Domain alignment: your background maps to this role's ${sharedDomains.join(", ")} focus.`);
  }
  if (missingSkills.length > 0) {
    explanation.push(`Room to grow: this role also uses ${missingSkills.slice(0, 3).join(", ")}.`);
  } else if (matchingSkills.length > 0) {
    explanation.push("Full alignment: your skillset covers every core technology listed.");
  }
  if (eligibilityNote) explanation.push(eligibilityNote);
  if (seniorityNote) explanation.push(seniorityNote);

  return {
    score,
    matchingSkills,
    missingSkills,
    matchSummary: explanation[0],
    matchExplanation: explanation,
  };
}

/**
 * Rank jobs by personalized match score, newest-first as a tiebreaker.
 * Mutates and returns the same array for convenience.
 */
export function rankByMatch<T extends { matchScore: number; createdAt?: string | Date }>(jobs: T[]): T[] {
  return jobs.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}
