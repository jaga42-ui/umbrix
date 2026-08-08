/**
 * The Evidence Detector.
 *
 * Decomposes a résumé bullet into what it actually proves: the action taken,
 * the technologies involved, the scope of the work, and the result. Whatever is
 * missing becomes a question the candidate can answer with a fact.
 *
 * Entirely deterministic — no model call. That is a requirement rather than an
 * optimisation: this runs on every bullet as the candidate types, it must give
 * the same verdict twice, and it must keep working when the AI layer is
 * unavailable. It also removes the single biggest hazard in this product
 * category, because a system that cannot generate text cannot invent an
 * achievement.
 *
 * The detector never proposes an answer. "How many users tested it?" is a
 * question; "used by 500 users" would be a fabrication.
 */

import type { EvidenceBullet, EvidenceStrength } from "./types";

/**
 * Verbs that denote ownership of work. Deliberately spans every field the
 * product serves — a nurse, a sales executive and a backend engineer all need
 * their bullets read, and a tech-only verb list would score three quarters of
 * Umbrix's users as evidence-free.
 */
const ACTION_VERBS = [
  // building / delivering
  "built", "created", "developed", "designed", "implemented", "shipped", "launched",
  "engineered", "architected", "prototyped", "deployed", "integrated", "migrated",
  "automated", "refactored", "optimised", "optimized", "configured", "programmed",
  // improving / operating
  "improved", "reduced", "increased", "streamlined", "resolved", "fixed", "debugged",
  "maintained", "scaled", "secured", "tested", "validated", "monitored",
  // people / process
  "led", "managed", "coordinated", "mentored", "trained", "supervised", "organised",
  "organized", "facilitated", "presented", "negotiated", "onboarded",
  // analysis / research
  "analysed", "analyzed", "researched", "modelled", "modeled", "forecast", "audited",
  "documented", "surveyed", "evaluated", "diagnosed",
  // commercial / service
  "sold", "generated", "acquired", "retained", "supported", "handled", "processed",
  "counselled", "counseled", "treated", "taught", "tutored", "assisted",
];

const ACTION_RE = new RegExp(`^\\s*(?:[-•*▪·]\\s*)?(${ACTION_VERBS.join("|")})\\b`, "i");

/**
 * Named tools, technologies and methods. Matched whole-word so "AI" cannot fire
 * inside "trainee" — a substring match on a two-letter token once tagged every
 * fresher posting on Umbrix with machine learning.
 */
const TECHNOLOGIES = [
  // languages
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "rust", "ruby",
  "php", "kotlin", "swift", "scala", "r", "matlab", "sql", "html", "css", "bash",
  // web / app
  "react", "next.js", "vue", "angular", "svelte", "node.js", "express", "django",
  "flask", "spring boot", "laravel", "rails", "tailwind", "bootstrap", "jquery",
  "react native", "flutter", "android", "ios",
  // data / infra
  "mongodb", "postgresql", "mysql", "redis", "sqlite", "firebase", "supabase",
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "git",
  "github actions", "nginx", "kafka", "rabbitmq", "graphql", "rest api", "websocket",
  "socket.io", "elasticsearch",
  // data science
  "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn", "opencv", "nlp",
  "machine learning", "deep learning", "power bi", "tableau", "excel", "spss",
  // design / product
  "figma", "adobe xd", "photoshop", "illustrator", "canva", "jira", "confluence",
  "notion", "trello", "agile", "scrum", "kanban",
  // business / other fields
  "salesforce", "hubspot", "zoho", "sap", "tally", "quickbooks", "google analytics",
  "seo", "google ads", "meta ads", "autocad", "solidworks", "ansys", "catia",
  "revit", "primavera", "canvas lms", "moodle",
];

const TECH_MATCHERS = TECHNOLOGIES.map((t) => ({
  name: t,
  re: new RegExp(`(?<![a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i"),
}));

/**
 * A stated size — how much, how many, how long.
 *
 * Scope answers "how big was this?" and is weaker evidence than a result, which
 * answers "what changed?". "8 modules" is scope; "cut load time 40%" is result.
 */
const SCOPE_RE =
  /\b\d+(?:,\d{3})*\+?\s*(?:users?|customers?|students?|clients?|patients?|records?|rows?|requests?|transactions?|orders?|modules?|screens?|pages?|endpoints?|tables?|members?|people|employees?|stores?|branches?|schools?|hours?|days?|weeks?|months?|years?|lakh|crore|k\b|mb|gb|tb)\b/i;

/**
 * A stated outcome, with the change it produced.
 *
 * Requires a change word near the number. A bare figure is scope, not result —
 * otherwise "8 modules" would read as a measured improvement.
 */
const RESULT_RE =
  /\b(?:reduc\w+|increas\w+|improv\w+|cut|sav\w+|grew|grow\w*|boost\w*|dropp\w+|rais\w+|accelerat\w+|speed(?:ed)? up|from)\b[^.]{0,40}?\d+(?:\.\d+)?\s*(?:%|percent|x\b|hours?|days?|minutes?|seconds?|ms\b|₹|rs\.?|lakh|crore)|\b\d+(?:\.\d+)?\s*(?:%|percent|x\b)\s*(?:faster|slower|more|less|higher|lower|improvement|increase|reduction|growth)/i;

/** A link in the text is external corroboration. */
const URL_RE = /(https?:\/\/|www\.|github\.com\/|\.vercel\.app|\.netlify\.app|\.com\/)/i;
/** Words indicating the work actually reached users. */
const SHIPPED_RE = /\b(deployed|live|in production|published|launched|released|shipped)\b/i;

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  return m ? m[0].trim() : undefined;
}

/**
 * Questions that would turn a weak bullet into evidence.
 *
 * Chosen by what the bullet lacks, and phrased so the answer is a fact the
 * candidate already knows. The product's value is helping someone *find* the
 * evidence they have and undersell — most freshers built something real and
 * described it as "worked on a project".
 */
function promptsFor(missing: string[], hasTech: boolean): string[] {
  const prompts: string[] = [];
  if (missing.includes("result")) {
    prompts.push("What changed because you built this?");
    prompts.push("Did it save time, reduce errors, or replace a manual step?");
  }
  if (missing.includes("scope")) {
    prompts.push("How many users, records or screens did it handle?");
  }
  if (missing.includes("technology") && !hasTech) {
    prompts.push("Which tools or technologies did you use?");
  }
  if (missing.includes("action")) {
    prompts.push("What did you personally do here — build, design, test, lead?");
  }
  // Only asked once the basics are present, or it reads as an interrogation.
  if (missing.length <= 1) {
    prompts.push("Is it deployed anywhere you can link to?");
  }
  return prompts.slice(0, 3);
}

/**
 * Classify how much a bullet proves.
 *
 * Each level requires everything below it, so the ladder is monotonic and a
 * candidate improving one component cannot lose a level.
 */
function classify(parts: {
  action?: string;
  technologies: string[];
  scope?: string;
  result?: string;
  verified: boolean;
}): EvidenceStrength {
  const { action, technologies, scope, result, verified } = parts;
  if (result && verified) return 5;
  if (result) return 4;
  // Level 3 needs technical substance, not merely a technology named in
  // passing: either a stated size alongside the tech, or a real stack. Naming
  // one tool is level 2 — "Built a React application" describes an activity,
  // it does not yet evidence depth.
  if (technologies.length >= 2 || (technologies.length > 0 && scope)) return 3;
  if (action || scope || technologies.length > 0) return 2;
  return 1;
}

/**
 * Analyse one bullet.
 *
 * @param text - The bullet as written, with or without its marker.
 * @param id - Stable identifier so the UI can key edits to a bullet.
 */
export function detectEvidence(text: string, id = ""): EvidenceBullet {
  const clean = String(text ?? "").replace(/^\s*[-•*▪·]\s*/, "").trim();

  const action = firstMatch(clean, ACTION_RE)?.replace(/^[-•*▪·]\s*/, "");
  const technologies = TECH_MATCHERS.filter((t) => t.re.test(clean)).map((t) => t.name);
  const scope = firstMatch(clean, SCOPE_RE);
  const result = firstMatch(clean, RESULT_RE);
  const verified = URL_RE.test(clean) || SHIPPED_RE.test(clean);

  const missing: EvidenceBullet["missing"] = [];
  if (!action) missing.push("action");
  if (technologies.length === 0) missing.push("technology");
  if (!scope) missing.push("scope");
  if (!result) missing.push("result");

  return {
    id,
    text: clean,
    action,
    technologies,
    scope,
    result,
    strength: classify({ action, technologies, scope, result, verified }),
    missing,
    prompts: promptsFor(missing, technologies.length > 0),
  };
}

/** Analyse many bullets, keeping their order. */
export function detectAll(bullets: string[]): EvidenceBullet[] {
  return bullets.map((b, i) => detectEvidence(b, String(i)));
}

/**
 * The single weakest bullet worth fixing next.
 *
 * Ties break toward the longest bullet: a long weak bullet occupies space a
 * recruiter is already spending, so improving it costs the candidate nothing in
 * length and gains the most.
 */
export function weakestBullet(bullets: EvidenceBullet[]): EvidenceBullet | null {
  if (bullets.length === 0) return null;
  return [...bullets].sort(
    (a, b) => a.strength - b.strength || b.text.length - a.text.length
  )[0];
}
