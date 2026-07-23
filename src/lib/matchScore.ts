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

// Discipline map for role alignment — canonical domain → the surface phrases
// that signal it, across EVERY field (not just tech), so a non-tech in-field
// role gets a real alignment signal instead of relying on field + eligibility
// alone. Canonical keys are human-readable because they surface in the per-card
// "why" copy. Generic words like "engineer"/"developer" are excluded (no
// discriminating signal); seniority is handled separately.
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // --- Tech / IT ---
  "frontend": ["frontend", "front-end", "front end"],
  "backend": ["backend", "back-end", "back end"],
  "full-stack": ["fullstack", "full-stack", "full stack"],
  "mobile": ["mobile", "ios", "android", "react native", "flutter"],
  "data / ML": ["data", "data science", "machine learning", "ml", "ai", "deep learning", "nlp"],
  "design": ["design", "designer", "ux", "ui", "product design"],
  "product": ["product manager", "product management"],
  "platform / infra": ["platform", "infrastructure", "infra", "devops", "sre", "site reliability"],
  "security": ["security", "infosec", "cybersecurity"],
  "qa": ["qa", "quality assurance", "test engineer", "sdet", "automation testing"],
  "cloud": ["cloud", "aws", "azure"],
  "analytics": ["analytics", "business intelligence", "bi analyst"],
  "developer relations": ["developer relations", "devrel", "developer advocate"],
  // --- Sales ---
  "sales": ["sales", "business development", "account executive", "account manager", "inside sales", "field sales", "telesales", "pre-sales", "sales development", "sdr", "bdr"],
  // --- Marketing ---
  "marketing": ["marketing", "digital marketing", "seo", "sem", "social media", "brand", "performance marketing", "email marketing", "ppc", "growth"],
  // --- Content / creative ---
  "content / creative": ["content writer", "content writing", "copywriter", "copywriting", "graphic design", "video editor", "photographer", "animation", "illustrator"],
  // --- Finance ---
  "finance / accounting": ["finance", "accounting", "accountant", "audit", "auditor", "taxation", "financial analyst", "investment banking", "treasury", "bookkeeping", "payroll", "credit analyst"],
  // --- HR ---
  "HR / recruiting": ["human resources", "hr", "recruitment", "recruiter", "talent acquisition", "people operations"],
  // --- Customer support ---
  "customer support": ["customer service", "customer support", "customer success", "call center", "bpo", "technical support", "help desk"],
  // --- Admin / ops ---
  "operations / admin": ["operations", "administrative", "office administrator", "executive assistant", "data entry", "back office"],
  // --- Logistics ---
  "logistics / supply chain": ["logistics", "supply chain", "warehouse", "inventory", "procurement", "dispatch", "fleet"],
  // --- Healthcare ---
  "healthcare": ["nurse", "nursing", "pharmacist", "pharmacy", "clinical", "medical", "physiotherapy", "radiology", "lab technician"],
  // --- Teaching ---
  "teaching": ["teacher", "teaching", "tutor", "faculty", "lecturer", "trainer", "instructor", "professor"],
  // --- Hospitality ---
  "hospitality": ["hospitality", "hotel", "chef", "cook", "front office", "housekeeping", "food and beverage", "f&b", "culinary"],
  // --- Consulting ---
  "consulting": ["consultant", "consulting", "advisory"],
  // --- Manufacturing ---
  "manufacturing / production": ["manufacturing", "production", "quality control", "maintenance", "assembly", "cnc", "fabrication"],
};

// Precompiled whole-word matchers (built once). Word boundaries — "not an ASCII
// letter/digit" on each side — stop short tokens from matching inside unrelated
// words (e.g. "ai" in "email", "hr" in "chair", "ml" in "html"), which naive
// substring matching got wrong.
const DOMAIN_MATCHERS: { domain: string; re: RegExp }[] = Object.entries(DOMAIN_SYNONYMS).flatMap(
  ([domain, phrases]) =>
    phrases.map((p) => ({
      domain,
      re: new RegExp(`(?<![a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i"),
    })),
);

/** Rough seniority ladder derived from a title string. 3 == mid (default). */
function seniorityRank(text: string): number {
  const t = ` ${text.toLowerCase()} `;
  if (/intern/.test(t)) return 1;
  // Students / freshers and explicit entry titles sit near the bottom of the
  // ladder. Critical for UMBRIX's audience: without this a fresher defaults to
  // mid (3), which mislabels intern/entry roles as "below your level".
  if (/(student|freshers?|final[\s-]?year|pre[\s-]?final|under\s?grad(uate)?|b\.?tech|bca|mca)/.test(t)) return 2;
  if (/(junior|\bjr\b|entry|associate|\bgrad\b|graduate|trainee|apprentice)/.test(t)) return 2;
  if (/(principal|staff|\blead\b|architect|director|head of|\bvp\b|vice president|chief)/.test(t)) return 5;
  if (/(senior|\bsr\b|sr\.)/.test(t)) return 4;
  return 3;
}

// Which canonical disciplines a text (a title or a background) names. Synonyms
// collapse to one canonical hit, so "front-end" and "frontend" don't double-count.
function domainKeywordsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const { domain, re } of DOMAIN_MATCHERS) {
    if (re.test(text)) found.add(domain);
  }
  return found;
}

/**
 * Skill synonyms → a single canonical token, so resume skills (LLM-parsed, free-
 * form) and job tags match despite formatting differences. Without this, "React"
 * vs "React.js", "JavaScript" vs "JS", or "PostgreSQL" vs "Postgres" silently
 * count as misses and under-score real overlaps. Keys and values are lowercase.
 */
const SKILL_ALIASES: Record<string, string> = {
  "js": "javascript", "ecmascript": "javascript",
  "ts": "typescript",
  "react.js": "react", "reactjs": "react",
  "react native": "react-native", "reactnative": "react-native",
  "node": "node.js", "nodejs": "node.js",
  "next": "next.js", "nextjs": "next.js",
  "postgres": "postgresql", "psql": "postgresql",
  "k8s": "kubernetes",
  "golang": "go",
  "py": "python",
  "ml": "machine learning",
  "gcp": "google cloud", "google cloud platform": "google cloud",
  "amazon web services": "aws",
  "c#": "csharp", "c sharp": "csharp",
  "c++": "cpp",
  "tailwindcss": "tailwind", "tailwind css": "tailwind",
  "ui": "ui/ux", "ux": "ui/ux", "uiux": "ui/ux",
  "gen ai": "genai", "generative ai": "genai",
};

/** Canonicalize a skill/tag for comparison — lowercased, with synonyms folded. */
function canonicalizeSkill(s: string): string {
  const key = s.trim().toLowerCase();
  return SKILL_ALIASES[key] ?? key;
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

  const skillSet = new Set(skills.map(canonicalizeSkill));
  const matchingSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const tag of jobTags) {
    if (skillSet.has(canonicalizeSkill(tag))) matchingSkills.push(tag);
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
    // Skills already credited via tags (compared canonically so aliases don't
    // double-count, e.g. a "React" tag and a "react.js" resume skill).
    const credited = new Set(matchingSkills.map(canonicalizeSkill));
    for (const skill of skills) {
      const canon = canonicalizeSkill(skill);
      if (credited.has(canon)) continue;
      if (desc.includes(skill.toLowerCase()) || desc.includes(canon)) {
        descHits++;
        credited.add(canon); // count each distinct skill at most once
      }
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
  // Field alignment: an in-field role ranks well above anything off-field — INCLUDING
  // the "general"/"graduate" Adzuna catch-alls, which are mostly generic trainee/HR
  // roles that shouldn't outrank real in-field jobs for a specialized candidate.
  const inField = Boolean(job.field && profile.targetFields?.includes(job.field));
  const fieldKnown = Boolean(job.field && profile.targetFields && profile.targetFields.length > 0);
  if (fieldKnown) {
    if (inField) score += FIELD_MATCH_BONUS;
    else score -= FIELD_MISMATCH_PENALTY;
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
