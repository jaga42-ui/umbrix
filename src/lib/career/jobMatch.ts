/**
 * Job → résumé alignment.
 *
 * Keyword matching alone is forbidden, and for a concrete reason: a résumé that
 * lists React and a résumé that shows React in a shipped project score
 * identically under keyword matching, while an interviewer treats them as
 * completely different candidates.
 *
 * Because Umbrix holds a Career Evidence Graph rather than a document, it can
 * make that distinction. Every requirement resolves to one of:
 *
 *   proven   a bullet demonstrates it, and we can name which one
 *   claimed  it is in the skills list with nothing behind it
 *   missing  nothing in the candidate's evidence touches it
 *
 * That is the difference between "87% match" and "you can prove 12 of the 18
 * things this job asks for, and here is exactly where". No score is reported
 * without the count it came from.
 *
 * Deterministic — no model call. Requirements are extracted from the posting's
 * own words and never invented.
 */

import type { CareerProfile } from "./types";
import { TECH_MATCHERS } from "./detector";

export type RequirementKind = "skill" | "experience" | "education";
export type RequirementStatus = "proven" | "claimed" | "missing";

export interface JobRequirement {
  id: string;
  /** The requirement as the posting expresses it. */
  label: string;
  kind: RequirementKind;
  /** Whether the posting frames it as required or preferred. */
  essential: boolean;
}

export interface RequirementMatch {
  requirement: JobRequirement;
  status: RequirementStatus;
  /** Where in the candidate's evidence this is demonstrated. */
  evidence: { itemTitle: string; bulletText: string }[];
}

export interface JobAlignment {
  matches: RequirementMatch[];
  proven: number;
  claimed: number;
  missing: number;
  total: number;
  /** A sentence stating the count, never a bare percentage. */
  summary: string;
  /** Essential requirements with nothing behind them. */
  criticalGaps: JobRequirement[];
}

/**
 * Sections of a posting that describe wants rather than duties.
 *
 * Extracting from the whole description would treat the company boilerplate
 * ("we use React across the business") as a requirement. Narrowing to the
 * requirements block keeps the list to what is actually being asked for.
 */
const REQUIREMENT_BLOCK_RE =
  /(requirements?|qualifications?|skills?|what you'?ll need|who you are|you should have|eligibility|must have)\s*:?\s*/i;

/** Language marking something as optional rather than required. */
const PREFERRED_RE = /\b(preferred|plus|bonus|nice to have|good to have|desirable|advantage|added advantage)\b/i;

/** "3+ years", "minimum 2 years" — an experience bar. */
const EXPERIENCE_RE =
  /\b(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:years?|yrs?)[^.]{0,24}?\b(?:experience|exp)\b/i;

/**
 * Competencies that are not technologies.
 *
 * The technology dictionary alone found requirements in only 28% of real India
 * listings, because most of them are not software roles — customer service,
 * BPO, sales, analyst and admin postings ask for shift availability, language
 * fluency and communication, and named none of the tools it knows about. This
 * is the same mistake the evidence detector deliberately avoids in its verb
 * list, repeated here and now corrected.
 *
 * Each entry is a competency a candidate can genuinely evidence, so it can
 * resolve to proven/claimed/missing like any other requirement.
 */
const COMPETENCY_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "communication skills", re: /\b(communication skills?|verbal and written|excellent communication)\b/i },
  { label: "customer service", re: /\b(customer (?:service|support|handling|care)|client servicing)\b/i },
  { label: "voice process", re: /\b(voice process|inbound|outbound|international voice|bpo)\b/i },
  { label: "English fluency", re: /\b(fluen\w+ in english|english (?:fluency|proficiency)|good english)\b/i },
  { label: "night / rotational shifts", re: /\b(night shifts?|rotational shifts?|24\*7|24x7|shift timings?)\b/i },
  { label: "sales", re: /\b(sales target|lead generation|cold call\w*|business development|b2b sales|b2c sales)\b/i },
  { label: "MS Office", re: /\b(ms[- ]office|microsoft office|word, excel|advanced excel)\b/i },
  { label: "accounting", re: /\b(accounting|book ?keeping|gst|taxation|accounts payable|accounts receivable)\b/i },
  { label: "data entry", re: /\b(data entry|typing speed|back ?office)\b/i },
  { label: "teamwork", re: /\b(team ?player|work in a team|cross[- ]functional teams?)\b/i },
  { label: "problem solving", re: /\b(problem[- ]solving|analytical skills?|troubleshoot\w*)\b/i },
  { label: "project management", re: /\b(project management|stakeholder management|client management)\b/i },
  { label: "teaching", re: /\b(teaching|lesson plan\w*|curriculum|tutoring)\b/i },
  { label: "patient care", re: /\b(patient care|clinical|nursing|bedside)\b/i },
];

/** Degree requirements common to Indian postings. */
const EDUCATION_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "B.Tech / B.E.", re: /\b(b\.?\s?tech|b\.?\s?e\.?|bachelor of (?:technology|engineering))\b/i },
  { label: "MCA", re: /\bmca\b/i },
  { label: "BCA", re: /\bbca\b/i },
  { label: "MBA", re: /\bmba\b/i },
  { label: "B.Sc", re: /\bb\.?\s?sc\b/i },
  { label: "B.Com", re: /\bb\.?\s?com\b/i },
  { label: "Any graduate degree", re: /\b(any graduate|graduate degree|bachelor'?s degree)\b/i },
];

/**
 * How far either side of a mention counts as "the same statement".
 *
 * Real postings are frequently punctuated with bullets, asterisks and pipes
 * rather than sentences — 51 of 120 sampled India listings contained fewer than
 * three full stops in the entire description. Scoping by full stop alone made
 * the window the whole document, so a single "preferred" anywhere marked every
 * requirement optional. A bounded window degrades sanely whatever the
 * punctuation.
 */
const PREFERENCE_WINDOW = 100;

/** Anything that plausibly ends a statement in a job posting. */
const STATEMENT_BREAK = /[.\n;|•*]/;

/**
 * Whether a mention sits in a statement framed as optional.
 *
 * Bounded on both sides, then narrowed to the nearest statement break inside
 * that window. A posting lists essentials and preferences in adjacent lines, so
 * judging by the whole document would be wrong in the common case.
 */
function isPreferred(text: string, index: number): boolean {
  const from = Math.max(0, index - PREFERENCE_WINDOW);
  const to = Math.min(text.length, index + PREFERENCE_WINDOW);

  const before = text.slice(from, index);
  const after = text.slice(index, to);

  // Trim back to the nearest break so an adjacent line cannot bleed in.
  const breakBefore = Math.max(...[...before.matchAll(new RegExp(STATEMENT_BREAK, "g"))].map((m) => m.index ?? -1), -1);
  const breakAfter = after.search(STATEMENT_BREAK);

  const statement =
    before.slice(breakBefore + 1) + (breakAfter === -1 ? after : after.slice(0, breakAfter));

  return PREFERRED_RE.test(statement);
}

/**
 * Extract what a posting actually asks for.
 *
 * @param description - The job description text.
 * @param title - The job title, which often names the core skill.
 */
export function extractRequirements(description: string, title = ""): JobRequirement[] {
  const full = `${title}\n${String(description ?? "")}`;
  // Prefer the requirements block when the posting has one; fall back to the
  // whole description rather than returning nothing.
  const blockIndex = full.search(REQUIREMENT_BLOCK_RE);
  const scope = blockIndex >= 0 ? full.slice(blockIndex) : full;

  const requirements: JobRequirement[] = [];
  const seen = new Set<string>();

  for (const { name, re } of TECH_MATCHERS) {
    const match = re.exec(scope);
    if (!match) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    requirements.push({
      id: `skill:${name}`,
      label: name,
      kind: "skill",
      essential: !isPreferred(scope, match.index),
    });
  }

  for (const { label, re } of COMPETENCY_PATTERNS) {
    const match = re.exec(scope);
    if (!match || seen.has(label)) continue;
    seen.add(label);
    requirements.push({
      id: `skill:${label}`,
      label,
      kind: "skill",
      essential: !isPreferred(scope, match.index),
    });
  }

  const experience = EXPERIENCE_RE.exec(full);
  if (experience) {
    const years = Number(experience[1]);
    if (Number.isFinite(years) && years > 0 && years <= 30) {
      requirements.push({
        id: "experience:years",
        label: `${years}+ years of experience`,
        kind: "experience",
        essential: !isPreferred(full, experience.index),
      });
    }
  }

  for (const { label, re } of EDUCATION_PATTERNS) {
    const match = re.exec(scope);
    if (!match) continue;
    requirements.push({
      id: `education:${label}`,
      label,
      kind: "education",
      essential: !isPreferred(scope, match.index),
    });
    // One degree requirement is enough; postings list alternatives, not extras.
    break;
  }

  return requirements;
}

/**
 * Resolve a posting's requirements against a candidate's evidence.
 *
 * @param requirements - From `extractRequirements`.
 * @param profile - The candidate's career evidence graph.
 * @param yearsOfExperience - Stated experience, when known. Undefined means the
 *   candidate has not said, which is reported as unproven rather than assumed.
 */
export function alignToProfile(
  requirements: JobRequirement[],
  profile: CareerProfile,
  yearsOfExperience?: number
): JobAlignment {
  const declared = new Set(profile.declaredSkills.map((s) => s.toLowerCase()));
  const education = profile.items.filter((i) => i.kind === "education").map((i) => i.title.toLowerCase());

  const matches: RequirementMatch[] = requirements.map((requirement) => {
    if (requirement.kind === "skill") {
      const skill = requirement.label.toLowerCase();
      const evidence: { itemTitle: string; bulletText: string }[] = [];
      for (const item of profile.items) {
        for (const bullet of item.bullets) {
          if (bullet.technologies.some((t) => t.toLowerCase() === skill)) {
            evidence.push({ itemTitle: item.title, bulletText: bullet.text });
          }
        }
      }
      if (evidence.length > 0) return { requirement, status: "proven", evidence };
      // Listed but never shown — the distinction this whole module exists for.
      return { requirement, status: declared.has(skill) ? "claimed" : "missing", evidence: [] };
    }

    if (requirement.kind === "experience") {
      const asked = Number(/(\d+)/.exec(requirement.label)?.[1] ?? 0);
      if (yearsOfExperience === undefined) return { requirement, status: "missing", evidence: [] };
      return {
        requirement,
        status: yearsOfExperience >= asked ? "proven" : "missing",
        evidence: [],
      };
    }

    const wanted = requirement.label.toLowerCase().split(/\s*\/\s*/);
    const held = education.some((e) => wanted.some((w) => e.includes(w.replace(/[.\s]/g, ""))|| e.includes(w)));
    return { requirement, status: held ? "proven" : "missing", evidence: [] };
  });

  const proven = matches.filter((m) => m.status === "proven").length;
  const claimed = matches.filter((m) => m.status === "claimed").length;
  const missing = matches.filter((m) => m.status === "missing").length;
  const total = matches.length;

  return {
    matches,
    proven,
    claimed,
    missing,
    total,
    // Deliberately a count, not a percentage. "87% match" tells a candidate
    // nothing they can act on and implies a precision this does not have.
    summary:
      total === 0
        ? "This posting doesn't list specific requirements we can check against."
        : `You can prove ${proven} of the ${total} things this job asks for` +
          (claimed > 0 ? `, and you list ${claimed} more without showing where you used them.` : "."),
    criticalGaps: matches
      .filter((m) => m.status === "missing" && m.requirement.essential)
      .map((m) => m.requirement),
  };
}

/** Convenience: extract and align in one call. */
export function matchJob(
  job: { title?: string; description?: string },
  profile: CareerProfile,
  yearsOfExperience?: number
): JobAlignment {
  return alignToProfile(
    extractRequirements(job.description ?? "", job.title ?? ""),
    profile,
    yearsOfExperience
  );
}
