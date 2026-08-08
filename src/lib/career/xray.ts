/**
 * Résumé X-Ray.
 *
 * A single number tells a candidate nothing about what to do. This breaks the
 * résumé into dimensions that fail independently, because they have independent
 * fixes: a résumé can be beautifully structured and prove nothing, or full of
 * measured outcomes and unreadable.
 *
 * Every dimension is computed from stated rules and reports the counts it used,
 * so the panel can answer "why is this 54%?" with arithmetic rather than an
 * assertion. These are diagnostic dimensions, not scientific measurements, and
 * the copy says so — there is no claim that 83% ATS structure means an 83%
 * chance of passing anyone's filter.
 */

import type { CareerProfile, EvidenceBullet } from "./types";
import { detectAll } from "./detector";

export type DimensionId =
  | "profile-signal"
  | "experience-evidence"
  | "technical-depth"
  | "impact-clarity"
  | "role-alignment"
  | "readability"
  | "ats-structure";

export interface Dimension {
  id: DimensionId;
  label: string;
  /** 0–100. */
  score: number;
  /** One line stating what the score is measuring. */
  what: string;
  /** The arithmetic behind this score, in words. */
  why: string;
  /** The next concrete action, or null when nothing needs doing. */
  how: string | null;
}

export interface XRay {
  dimensions: Dimension[];
  /** Unweighted mean. Presented as a summary, never as the headline. */
  overall: number;
  strengths: Dimension[];
  opportunities: Dimension[];
}

/** Bullets longer than this are hard to scan in a six-second read. */
const LONG_BULLET_CHARS = 240;
/** A résumé wants at least this many bullets to be assessable at all. */
const MIN_BULLETS = 4;

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Every bullet across every evidence item, already decomposed. */
function allBullets(profile: CareerProfile): EvidenceBullet[] {
  const out: EvidenceBullet[] = [];
  for (const item of profile.items) {
    // Items may arrive with bullets already analysed, or as raw text.
    for (const b of item.bullets) {
      out.push(b.strength ? b : detectAll([b.text])[0]);
    }
  }
  return out;
}

function profileSignal(profile: CareerProfile): Dimension {
  const { identity } = profile;
  const checks = [
    { ok: Boolean(identity.name), label: "name" },
    { ok: Boolean(identity.email), label: "email" },
    { ok: Boolean(identity.phone), label: "phone" },
    { ok: identity.links.length > 0, label: "a profile or portfolio link" },
    { ok: Boolean(identity.headline || identity.summary), label: "a headline" },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return {
    id: "profile-signal",
    label: "Profile signal",
    score: pct(checks.length - missing.length, checks.length),
    what: "Whether a recruiter can identify and contact you immediately.",
    why: `${checks.length - missing.length} of ${checks.length} identity elements present.`,
    how: missing.length > 0 ? `Add ${missing.join(", ")}.` : null,
  };
}

function experienceEvidence(profile: CareerProfile, bullets: EvidenceBullet[]): Dimension {
  const items = profile.items.length;
  // Level 3+ means the bullet names technologies or scope, not just a claim.
  const substantive = bullets.filter((b) => b.strength >= 3).length;
  const score = items === 0 || bullets.length === 0 ? 0 : clamp(pct(substantive, bullets.length) * 0.7 + Math.min(items, 4) * 7.5);
  return {
    id: "experience-evidence",
    label: "Experience evidence",
    score,
    what: "How much of your history is backed by specifics rather than claims.",
    why: `${items} evidence item${items === 1 ? "" : "s"}, ${substantive} of ${bullets.length} bullets at technical level or above.`,
    how:
      bullets.length < MIN_BULLETS
        ? "Add more detail to your projects — two or three bullets each."
        : substantive < bullets.length / 2
          ? "Name the tools you used and the size of what you handled."
          : null,
  };
}

function technicalDepth(profile: CareerProfile, bullets: EvidenceBullet[]): Dimension {
  const evidenced = new Set(bullets.flatMap((b) => b.technologies.map((t) => t.toLowerCase())));
  const declared = new Set(profile.declaredSkills.map((s) => s.toLowerCase()));
  const unevidenced = [...declared].filter((s) => !evidenced.has(s));
  // Listing a skill is cheap; showing where you used it is the signal.
  const coverage = declared.size === 0 ? 0 : pct(declared.size - unevidenced.length, declared.size);
  const score = clamp(coverage * 0.6 + Math.min(evidenced.size, 8) * 5);
  return {
    id: "technical-depth",
    label: "Technical depth",
    score,
    what: "Whether the skills you list actually appear in the work you describe.",
    why: `${evidenced.size} skill${evidenced.size === 1 ? "" : "s"} demonstrated in bullets; ${unevidenced.length} listed without a supporting bullet.`,
    how:
      unevidenced.length > 0
        ? `Show where you used ${unevidenced.slice(0, 3).join(", ")} — a listed skill with no example is the first thing an interviewer probes.`
        : null,
  };
}

function impactClarity(bullets: EvidenceBullet[]): Dimension {
  const measured = bullets.filter((b) => b.result).length;
  const score = bullets.length === 0 ? 0 : pct(measured, bullets.length);
  const weakest = bullets.filter((b) => !b.result).length;
  return {
    id: "impact-clarity",
    label: "Impact clarity",
    score,
    what: "How many bullets show what changed, not just what you did.",
    why: `${measured} of ${bullets.length} bullets state a measurable outcome.`,
    how:
      weakest > 0
        ? `${weakest} bullet${weakest === 1 ? "" : "s"} describe activity without a result. We'll ask you what changed — we never fill these in for you.`
        : null,
  };
}

function roleAlignment(profile: CareerProfile, bullets: EvidenceBullet[]): Dimension {
  const targets = profile.targetFields;
  const evidenced = new Set(bullets.flatMap((b) => b.technologies.map((t) => t.toLowerCase())));
  // Without a stated target there is nothing to align to; that is itself the gap.
  if (targets.length === 0) {
    return {
      id: "role-alignment",
      label: "Role alignment",
      score: 0,
      what: "Whether your evidence points at the roles you want.",
      why: "No target role set, so there is nothing to align your evidence against.",
      how: "Pick the roles you're aiming for — alignment is measured against them.",
    };
  }
  const score = clamp(Math.min(evidenced.size, 10) * 8 + (profile.items.length > 0 ? 20 : 0));
  return {
    id: "role-alignment",
    label: "Role alignment",
    score,
    what: "Whether your evidence points at the roles you want.",
    why: `Targeting ${targets.join(", ")}; ${evidenced.size} distinct skills evidenced across ${profile.items.length} items.`,
    how: score < 60 ? "Lead with the projects closest to your target role and move the rest down." : null,
  };
}

function readability(bullets: EvidenceBullet[]): Dimension {
  const long = bullets.filter((b) => b.text.length > LONG_BULLET_CHARS);
  const noAction = bullets.filter((b) => !b.action);
  const penalties = pct(long.length, Math.max(bullets.length, 1)) + pct(noAction.length, Math.max(bullets.length, 1)) * 0.5;
  return {
    id: "readability",
    label: "Readability",
    score: bullets.length === 0 ? 0 : clamp(100 - penalties),
    what: "Whether a recruiter can scan this in a few seconds.",
    why: `${long.length} bullet${long.length === 1 ? "" : "s"} over ${LONG_BULLET_CHARS} characters; ${noAction.length} not starting with an action verb.`,
    how:
      long.length > 0
        ? "Split the longest bullets — one idea each."
        : noAction.length > 0
          ? "Open each bullet with a verb: Built, Led, Reduced."
          : null,
  };
}

function atsStructure(profile: CareerProfile, bullets: EvidenceBullet[]): Dimension {
  const checks = [
    { ok: Boolean(profile.identity.email), label: "a plain-text email" },
    { ok: profile.items.some((i) => i.kind === "education"), label: "an education section" },
    { ok: profile.items.some((i) => i.kind === "experience" || i.kind === "project"), label: "experience or projects" },
    { ok: profile.declaredSkills.length >= 5, label: "a skills list of five or more" },
    { ok: bullets.length >= MIN_BULLETS, label: `at least ${MIN_BULLETS} bullets` },
    { ok: profile.items.every((i) => !i.startDate || Boolean(i.endDate || i.current)), label: "complete date ranges" },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return {
    id: "ats-structure",
    label: "ATS structure",
    score: pct(checks.length - missing.length, checks.length),
    what: "Whether an applicant tracking system can parse this into fields.",
    why: `${checks.length - missing.length} of ${checks.length} structural checks pass.`,
    how: missing.length > 0 ? `Add ${missing.join(", ")}.` : null,
  };
}

/** Run every dimension over a career profile. */
export function xray(profile: CareerProfile): XRay {
  const bullets = allBullets(profile);
  const dimensions = [
    profileSignal(profile),
    experienceEvidence(profile, bullets),
    technicalDepth(profile, bullets),
    impactClarity(bullets),
    roleAlignment(profile, bullets),
    readability(bullets),
    atsStructure(profile, bullets),
  ];

  return {
    dimensions,
    overall: Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length),
    // A dimension only counts as a strength if there is genuinely nothing to do.
    strengths: dimensions.filter((d) => d.score >= 75 && d.how === null),
    opportunities: [...dimensions].filter((d) => d.how !== null).sort((a, b) => a.score - b.score),
  };
}
