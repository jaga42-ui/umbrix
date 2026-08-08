/**
 * The Career Evidence Graph.
 *
 * A résumé is treated as one *view* of a candidate's evidence, not as the
 * primary record. The primary record is a set of discrete evidence items —
 * education, projects, work, achievements — each carrying its own metadata.
 * Generating a frontend résumé and a data résumé then becomes a question of
 * which evidence to select and how to order it, rather than maintaining two
 * divergent documents.
 *
 * Two constraints run through every type here:
 *
 *  1. **Provenance is explicit.** Every item records where it came from and how
 *     confident we are. Something parsed out of a PDF with low confidence must
 *     be visibly distinguishable from something the candidate typed, so the UI
 *     can ask for verification instead of silently presenting a guess as fact.
 *  2. **Nothing is inferred into existence.** There is no field the system fills
 *     with a plausible value. Absent evidence is absent, and the product's job
 *     is to help the candidate supply it — never to invent it.
 */

/** Where a piece of evidence came from. Drives whether we ask for verification. */
export type EvidenceSource =
  /** The candidate typed it. Highest trust. */
  | "user"
  /** Extracted from an uploaded document by deterministic parsing. */
  | "parsed"
  /** Extracted by the language model. Needs review when confidence is low. */
  | "llm"
  /** Derived from an external link the candidate supplied (e.g. a repository). */
  | "linked";

/**
 * How strong a claim is, per the evidence ladder.
 *
 * The levels are deliberately about *what the sentence proves*, not about how
 * impressive it sounds:
 *
 *   1 claim              "Built a React application."
 *   2 specific activity  "Built a React application with 8 modules."
 *   3 technical evidence "...using React Router and a reusable component library."
 *   4 measured outcome   "...serving 500+ test users."
 *   5 verified           "...deployed at <url>, 500+ users."
 */
export type EvidenceStrength = 1 | 2 | 3 | 4 | 5;

export const EVIDENCE_STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  1: "Claim",
  2: "Specific activity",
  3: "Technical evidence",
  4: "Measured outcome",
  5: "Verified externally",
};

/** The kinds of evidence a career is made of. */
export type EvidenceKind =
  | "education"
  | "experience"
  | "project"
  | "certification"
  | "achievement"
  | "publication"
  | "leadership"
  | "volunteering"
  | "competition";

/**
 * One line of evidence — typically a résumé bullet, but it exists independently
 * of any résumé and can appear in several of them.
 */
export interface EvidenceBullet {
  id: string;
  text: string;
  /** The verb the sentence opens with, when it opens with one. */
  action?: string;
  /** Technologies, tools or methods named in the text. */
  technologies: string[];
  /** A stated size: "8 modules", "500 users", "3 months". */
  scope?: string;
  /** A stated outcome: "reduced load time by 40%". */
  result?: string;
  strength: EvidenceStrength;
  /** Which components of a complete claim are absent. */
  missing: ("action" | "technology" | "scope" | "result")[];
  /**
   * Questions that would uncover the missing evidence, phrased so the candidate
   * supplies a fact. Never a suggested answer.
   */
  prompts: string[];
}

/** A single item in the graph: one job, one project, one degree. */
export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  /** Role, project name, degree — the item's headline. */
  title: string;
  /** Employer, institution, client, or "Personal project". */
  organization?: string;
  startDate?: string;
  endDate?: string;
  /** True when this is ongoing; keeps "Present" out of the date fields. */
  current?: boolean;
  location?: string;
  /** A verifiable link — repository, deployment, certificate. */
  url?: string;
  bullets: EvidenceBullet[];
  /** Skills this item demonstrates, aggregated from its bullets plus any typed. */
  skills: string[];
  source: EvidenceSource;
  /**
   * 0–1. Below `VERIFY_BELOW` the UI must mark the item "Needs verification"
   * rather than presenting it as established.
   */
  confidence: number;
}

/** Confidence under this is shown to the candidate as needing verification. */
export const VERIFY_BELOW = 0.7;

export interface CandidateIdentity {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  /** Labelled links — LinkedIn, GitHub, portfolio. */
  links: { label: string; url: string }[];
  /** One-line professional positioning, written by the candidate. */
  headline?: string;
  summary?: string;
}

/** The whole graph for one candidate. */
export interface CareerProfile {
  identity: CandidateIdentity;
  items: EvidenceItem[];
  /** Skills the candidate claims directly, separate from those evidenced. */
  declaredSkills: string[];
  /** Fields the candidate is targeting, from the shared taxonomy. */
  targetFields: string[];
  updatedAt?: string;
}

/**
 * Skills that appear in at least one bullet, i.e. skills the profile can
 * actually evidence rather than merely list.
 *
 * The distinction matters: a résumé listing React with no React bullet is the
 * exact weakness the product is meant to surface, so the two sets are kept
 * apart rather than merged.
 */
export function evidencedSkills(profile: CareerProfile): string[] {
  const seen = new Set<string>();
  for (const item of profile.items) {
    for (const bullet of item.bullets) {
      for (const tech of bullet.technologies) seen.add(tech);
    }
  }
  return [...seen].sort();
}

/** Declared skills with no supporting bullet anywhere in the graph. */
export function unevidencedSkills(profile: CareerProfile): string[] {
  const evidenced = new Set(evidencedSkills(profile).map((s) => s.toLowerCase()));
  return profile.declaredSkills.filter((s) => !evidenced.has(s.toLowerCase())).sort();
}
