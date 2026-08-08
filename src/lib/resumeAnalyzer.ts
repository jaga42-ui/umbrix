/**
 * Résumé analysis.
 *
 * Every check here is deterministic and runs on the résumé text alone — no LLM
 * call. That is a product decision, not a shortcut: the analysis returns in
 * milliseconds, costs nothing per run, gives the same answer twice, and can be
 * pinned by tests. A model is the wrong tool for "does this bullet contain a
 * number". It earns its place only where judgement is genuinely required, which
 * is rewriting, not detecting.
 *
 * Two rules shape the output:
 *
 *  1. **Every finding carries the exact fix and the offending text.** "Improve
 *     your résumé" is worthless. "These 4 bullets start with 'Responsible for'
 *     — here they are, open with an action verb instead" is worth paying for.
 *  2. **Nothing is invented.** Findings are only ever raised from text actually
 *     present. The analyzer never claims a résumé says something it does not,
 *     and never manufactures a strength to pad the report.
 */

export type Severity = "critical" | "important" | "polish";
export type Category = "ats" | "impact" | "content" | "structure" | "regional";

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  /** One line naming the problem, with a count where one applies. */
  title: string;
  /** Why it costs the candidate something. */
  detail: string;
  /** Exactly what to change. */
  fix: string;
  /** The offending lines, so the user can find them instantly. */
  evidence?: string[];
}

export interface ResumeStats {
  words: number;
  bullets: number;
  quantifiedBullets: number;
  skills: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasLinks: boolean;
}

export interface ResumeAnalysis {
  /** 0–100. Deductions are weighted by severity; see SEVERITY_COST. */
  score: number;
  band: "needs-work" | "getting-there" | "strong";
  findings: Finding[];
  /** Only things the résumé genuinely does well — never padded. */
  strengths: string[];
  stats: ResumeStats;
}

export interface AnalyzerInput {
  /** Raw extracted résumé text. */
  text: string;
  /** Structured fields from the parser, when available. */
  skills?: string[];
  experience?: { role: string; company: string; description?: string }[];
  education?: string[];
  email?: string;
}

/** What each severity costs the score. Tuned so one critical issue still hurts. */
const SEVERITY_COST: Record<Severity, number> = { critical: 14, important: 7, polish: 3 };

/** A fresher résumé that runs past this reads as padded. */
const MAX_WORDS_ONE_PAGE = 650;
const MIN_WORDS_CREDIBLE = 150;

/** Openings that describe duties instead of results. */
const WEAK_OPENERS =
  /^\s*(?:[-•*▪·]\s*)?(responsible for|worked on|helped (?:with|in)?|assisted (?:with|in)?|involved in|participated in|tasked with|duties includ|part of a team)/i;

/** Claims that carry no information because everyone writes them. */
const FILLER_PHRASES = [
  "team player", "hard working", "hardworking", "self motivated", "self-motivated",
  "go getter", "go-getter", "detail oriented", "detail-oriented", "quick learner",
  "passionate about", "results driven", "results-driven", "think outside the box",
  "excellent communication skills", "good communication skills",
];

/**
 * Personal details conventional on Indian résumés that should not be there.
 *
 * This is the check generic Western tools miss entirely, and it is the one most
 * likely to be actively costing an Indian candidate: date of birth, marital
 * status, father's name, gender and photographs are still routinely included
 * here, but they add no hiring signal, consume space on a one-page fresher
 * résumé, and invite bias — which is exactly why most global employers ask
 * candidates to omit them.
 */
const PERSONAL_DETAIL_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "date of birth", re: /\b(date of birth|d\.?o\.?b\.?)\b/i },
  { label: "marital status", re: /\bmarital status\b/i },
  { label: "father's name", re: /\b(father'?s? name|s\/o\b)/i },
  { label: "gender", re: /^\s*gender\s*[:\-]/im },
  { label: "nationality", re: /^\s*nationality\s*[:\-]/im },
  { label: "photograph", re: /\b(passport size photo|photograph attached|affix photo)\b/i },
];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
// Indian mobile numbers, with or without +91 and common separators.
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b\d{10}\b/;
const LINK_RE = /(linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|https?:\/\/)/i;
/** A bullet is "quantified" if it carries a number that means something. */
const QUANTIFIER_RE = /\b\d+(?:\.\d+)?\s*(?:%|percent|x\b|k\b|lakh|crore|users?|customers?|students?|hours?|days?|weeks?|months?|projects?|members?|₹|rs\.?)|\b(?:₹|rs\.?)\s*\d/i;
const FIRST_PERSON_RE = /\b(i|my|me|myself)\b/gi;

/** "Date of Birth: 22/08/2003", "Father's Name: …" — a field, not an achievement. */
const LABEL_VALUE_RE = /^[A-Za-z][A-Za-z'’. ]{0,24}:/;
/** "TECHNICAL SKILLS", "CAREER OBJECTIVE" — a section heading. */
const SECTION_HEADING_RE = /^[A-Z0-9 &,'()/\-]+$/;

/**
 * Lines that are genuinely résumé bullets.
 *
 * An earlier version accepted any line of 25+ characters starting with a
 * capital, which swept up section headings and personal-detail fields. That was
 * not cosmetic: it inflated the denominator of the quantification check ("1 of 8
 * bullets") and quoted "Date of Birth: 22/08/2003" back to the user as a bullet
 * lacking a measurable result.
 *
 * Explicit markers are trusted when present. Only when a résumé uses none do we
 * fall back to prose lines, and even then headings and label/value fields are
 * excluded.
 */
function extractBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 25);

  const marked = lines.filter((l) => /^[-•*▪·]/.test(l));
  if (marked.length > 0) return marked;

  return lines.filter(
    (l) => /^[A-Za-z]/.test(l) && !LABEL_VALUE_RE.test(l) && !SECTION_HEADING_RE.test(l)
  );
}

function truncate(s: string, n = 90): string {
  return s.length <= n ? s : s.slice(0, n).trimEnd() + "…";
}

/**
 * Analyse a résumé.
 *
 * @param input - Raw text plus whatever the parser managed to structure.
 * @returns Score, findings each with a concrete fix, and genuine strengths.
 */
export function analyzeResume(input: AnalyzerInput): ResumeAnalysis {
  const text = String(input.text ?? "");
  const findings: Finding[] = [];
  const strengths: string[] = [];

  const words = text.split(/\s+/).filter(Boolean).length;
  const bullets = extractBullets(text);
  const quantified = bullets.filter((b) => QUANTIFIER_RE.test(b));
  const skills = input.skills ?? [];

  const hasEmail = EMAIL_RE.test(text) || Boolean(input.email);
  const hasPhone = PHONE_RE.test(text);
  const hasLinks = LINK_RE.test(text);

  const stats: ResumeStats = {
    words,
    bullets: bullets.length,
    quantifiedBullets: quantified.length,
    skills: skills.length,
    hasEmail,
    hasPhone,
    hasLinks,
  };

  // --- Recruiters cannot contact you: nothing outranks this ----------------
  if (!hasEmail) {
    findings.push({
      id: "no-email",
      severity: "critical",
      category: "ats",
      title: "No email address found",
      detail:
        "Applicant tracking systems key a candidate record on the email address. Without one, an application can be parsed and then dropped with no way to reach you.",
      fix: "Put a professional email at the top, on its own line, as plain text — not inside a header, image or text box.",
    });
  }
  if (!hasPhone) {
    findings.push({
      id: "no-phone",
      severity: "important",
      category: "ats",
      title: "No phone number found",
      detail: "Most Indian recruiters call or message before emailing. A missing number removes the fastest route to you.",
      fix: "Add a 10-digit mobile number near your email, as plain digits.",
    });
  }
  if (!hasLinks) {
    findings.push({
      id: "no-links",
      severity: "important",
      category: "content",
      title: "No LinkedIn or portfolio link",
      detail:
        "For a fresher with limited work history, a profile or project link is often the only evidence a recruiter can verify independently.",
      fix: "Add your LinkedIn URL, and GitHub or a portfolio link if your field has one.",
    });
  }

  // --- Impact: the single biggest quality gap on fresher résumés -----------
  if (bullets.length > 0) {
    const ratio = quantified.length / bullets.length;
    if (ratio < 0.25) {
      findings.push({
        id: "low-quantification",
        severity: "critical",
        category: "impact",
        title: `Only ${quantified.length} of ${bullets.length} bullets contain a measurable result`,
        detail:
          "Numbers are what separate a description of duties from evidence of impact. Without them every candidate's bullets read identically.",
        fix:
          'Add a figure to your strongest bullets — users served, time saved, percentage improved, team size, marks or rank. "Built a booking page" becomes "Built a booking page used by 400+ students".',
        // Wrapped, not point-free: `.map(truncate)` would pass the array index
        // as the length argument and clip the first item to nothing.
        evidence: bullets.filter((b) => !QUANTIFIER_RE.test(b)).slice(0, 3).map((b) => truncate(b)),
      });
    } else if (ratio >= 0.5) {
      strengths.push(`${quantified.length} of ${bullets.length} bullets carry a concrete number`);
    }
  }

  const weak = bullets.filter((b) => WEAK_OPENERS.test(b));
  if (weak.length > 0) {
    findings.push({
      id: "weak-openers",
      severity: weak.length >= 3 ? "important" : "polish",
      category: "impact",
      title: `${weak.length} bullet${weak.length === 1 ? "" : "s"} open with a passive phrase`,
      detail:
        '"Responsible for" and "Worked on" describe a job description rather than what you personally achieved.',
      fix: "Start each bullet with a verb that names what you did — Built, Shipped, Automated, Reduced, Led, Designed, Migrated.",
      evidence: weak.slice(0, 3).map((b) => truncate(b)),
    });
  }

  const foundFiller = FILLER_PHRASES.filter((p) => text.toLowerCase().includes(p));
  if (foundFiller.length > 0) {
    findings.push({
      id: "filler-phrases",
      severity: "polish",
      category: "content",
      title: `${foundFiller.length} unverifiable claim${foundFiller.length === 1 ? "" : "s"}`,
      detail:
        "Phrases every candidate writes carry no signal, and they consume space that evidence could occupy.",
      fix: "Replace each with something demonstrable, or delete it. Instead of \"quick learner\", name the thing you taught yourself and what you built with it.",
      evidence: foundFiller.slice(0, 4),
    });
  }

  // --- Regional conventions that cost Indian candidates --------------------
  const personal = PERSONAL_DETAIL_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  if (personal.length > 0) {
    findings.push({
      id: "personal-details",
      severity: "important",
      category: "regional",
      title: `Personal details that don't belong on a résumé: ${personal.join(", ")}`,
      detail:
        "These are conventional on Indian résumés but add no hiring signal, use space you need for evidence, and invite bias — which is why most employers ask candidates to leave them out.",
      fix: `Delete the ${personal.join(", ")} line${personal.length === 1 ? "" : "s"} and use the space for a project or a measurable result.`,
    });
  }

  const firstPerson = (text.match(FIRST_PERSON_RE) ?? []).length;
  if (firstPerson >= 5) {
    findings.push({
      id: "first-person",
      severity: "polish",
      category: "structure",
      title: `First-person pronouns used ${firstPerson} times`,
      detail: "Résumés are conventionally written without 'I' or 'my'; the subject is understood.",
      fix: 'Drop the pronouns — "I built a dashboard" becomes "Built a dashboard".',
    });
  }

  // --- Length ---------------------------------------------------------------
  if (words > MAX_WORDS_ONE_PAGE) {
    findings.push({
      id: "too-long",
      severity: "important",
      category: "structure",
      title: `About ${words} words — longer than one page`,
      detail:
        "A fresher résumé is expected to fit one page. Past that, the strongest material competes with filler for attention.",
      fix: "Cut to your strongest material: keep recent, relevant and measurable items; drop school-level achievements and duplicated skills.",
    });
  } else if (words < MIN_WORDS_CREDIBLE && words > 0) {
    findings.push({
      id: "too-short",
      severity: "critical",
      category: "content",
      title: `Only about ${words} words of content`,
      detail:
        "There is not enough here for a recruiter to assess you, and an ATS will extract very little to match against.",
      fix: "Add a projects section with 2–3 bullets each: what you built, the tools you used, and the outcome.",
    });
  } else if (words > 0) {
    strengths.push("Length fits on one page");
  }

  // --- Skills ---------------------------------------------------------------
  if (skills.length === 0) {
    findings.push({
      id: "no-skills",
      severity: "critical",
      category: "ats",
      title: "No skills could be extracted",
      detail:
        "If our parser found no skills, an employer's ATS will struggle too — usually caused by skills living inside tables, columns, images or a header.",
      fix: "Add a plain 'Skills' section as a simple comma-separated list in the body of the document.",
    });
  } else if (skills.length < 5) {
    findings.push({
      id: "few-skills",
      severity: "important",
      category: "ats",
      title: `Only ${skills.length} skill${skills.length === 1 ? "" : "s"} detected`,
      detail: "Skill keywords are what most ATS filters match on. A short list narrows the roles you can surface for.",
      fix: "List the tools, technologies and software you have genuinely used — including coursework and project tools. Never list one you cannot discuss.",
    });
  } else {
    strengths.push(`${skills.length} concrete skills detected`);
  }

  if ((input.experience?.length ?? 0) === 0) {
    findings.push({
      id: "no-experience-section",
      severity: "critical",
      category: "content",
      title: "No experience or projects found",
      detail:
        "With neither work history nor projects there is nothing for a recruiter to evaluate, and nothing for match scoring to work from.",
      fix: "Add internships if you have them. If not, projects count — give each a title, the tools used, and what it does.",
    });
  } else if ((input.experience?.length ?? 0) >= 2) {
    strengths.push(`${input.experience!.length} experience or project entries`);
  }

  if ((input.education?.length ?? 0) > 0) strengths.push("Education section present");

  // --- Score ---------------------------------------------------------------
  // Start at 100 and deduct. A résumé with no findings scores 100 legitimately,
  // so the number means something rather than being curved.
  const deduction = findings.reduce((sum, f) => sum + SEVERITY_COST[f.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - deduction));

  findings.sort((a, b) => SEVERITY_COST[b.severity] - SEVERITY_COST[a.severity]);

  return {
    score,
    band: score >= 80 ? "strong" : score >= 55 ? "getting-there" : "needs-work",
    findings,
    strengths,
    stats,
  };
}
