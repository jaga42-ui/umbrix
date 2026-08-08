/**
 * Raw source category → normalized `JobCategory`.
 *
 * CLAUDE.md specifies this mapper at `scripts/normalizeCategory.js` and
 * requires that "every adapter must map its raw categories to one of these" —
 * but the file has never existed. Every source's raw department string
 * ("Engineering - Backend", "Sales & BD", "R&D") therefore reaches the database
 * verbatim, so category is unusable as a filter and the rule is unenforced.
 *
 * Matching is keyword-based over the raw string and the job title, ordered
 * most-specific first. Ordering is the whole design: "sales engineer" must
 * resolve to sales, not engineering, so the narrower rule has to win. An
 * unmatched value returns "general" — never null, per the same rule.
 */

import { JOB_CATEGORIES, type JobCategory } from '@umbrix/core';
import { comparableText } from './text';

interface CategoryRule {
  category: JobCategory;
  /** Ordered: the first rule whose pattern matches wins. */
  pattern: RegExp;
}

const RULES: CategoryRule[] = [
  // --- Narrow rules first: these contain words that broader rules also claim.
  { category: 'sales', pattern: /\b(sales|business development|bd|inside sales|account executive|pre-?sales|revenue)\b/ },
  { category: 'customer-service', pattern: /\b(customer (support|service|success|experience)|bpo|call ?c(en|ent)re|voice process|helpdesk|technical support|tele ?caller)\b/ },
  { category: 'hr', pattern: /\b(human resources|hr|recruit\w*|talent acquisition|people ops|staffing|payroll)\b/ },
  { category: 'finance', pattern: /\b(financ\w*|account\w*|audit\w*|tax\w*|treasury|banking|investment|actuar\w*|book ?keep\w*)\b/ },
  { category: 'marketing', pattern: /\b(marketing|seo|sem|brand\w*|growth|content marketing|social media|digital marketing|communications|pr)\b/ },
  // "design" is deliberately NOT matched on its own. It appears constantly in
  // engineering titles ("Mechanical Design Engineer", "Design Engineer"), and a
  // bare match sent every one of them to creative. Match the noun "designer",
  // or a named design discipline, instead.
  { category: 'creative', pattern: /\b(designer|graphic|ui\/?ux|ux|visual design\w*|interior design\w*|fashion design\w*|motion graphics|creative|video (editing|editor|production)|photograph\w*|animation|copywrit\w*|content writ\w*)\b/ },
  { category: 'logistics', pattern: /\b(logistics|supply chain|warehouse|procure\w*|inventory|dispatch|fleet|shipping|import|export)\b/ },
  { category: 'healthcare', pattern: /\b(health\w*|medical|nurs\w*|pharma\w*|clinical|hospital|doctor|physician|dental|patholog\w*|laborator\w*)\b/ },
  { category: 'teaching', pattern: /\b(teach\w*|tutor\w*|educat\w*|faculty|professor|lectur\w*|academic|trainer|curriculum|instructor)\b/ },
  { category: 'hospitality', pattern: /\b(hospitality|hotel|restaurant|chef|culinary|food and beverage|f&b|front office|housekeep\w*|travel|tourism)\b/ },
  { category: 'retail', pattern: /\b(retail|store|merchandis\w*|cashier|shop ?floor|point of sale|category management)\b/ },
  { category: 'consultancy', pattern: /\b(consult\w*|advisory|strateg\w*|business analyst|research analyst|market research)\b/ },
  { category: 'manufacturing', pattern: /\b(manufactur\w*|production|plant|factory|assembly|fabricat\w*|machin\w*|welding|cnc|shop ?floor|quality (control|assurance)|qa\/?qc)\b/ },
  { category: 'admin', pattern: /\b(admin\w*|operations|back ?office|data entry|clerical|secretar\w*|office manag\w*|facilit\w*|reception\w*)\b/ },
  { category: 'government', pattern: /\b(government|govt|public sector|psu|municipal|railway|defence|defense|civil service|sarkari)\b/ },
  { category: 'scholarship', pattern: /\b(scholarship|fellowship|grant|stipend award)\b/ },

  // --- Broad rules last: "engineering" and "it" overlap with nearly everything.
  { category: 'it', pattern: /\b(software|developer|programmer|full ?stack|front ?end|back ?end|devops|sre|data (scien\w*|engineer\w*|analy\w*)|machine learning|ml|ai|cloud|cyber ?security|qa engineer|sdet|it\b|information technology|web|mobile|android|ios)\b/ },
  { category: 'engineering', pattern: /\b(engineer\w*|mechanical|electrical|electronics|civil|chemical|aerospace|automobile|instrumentation|r&d|technical)\b/ },
];

/**
 * Map a raw source category to a normalized one.
 *
 * @param raw - The source's own category/department string. May be empty.
 * @param title - Job title, used as a fallback signal when `raw` is absent or
 *   unrecognised — most ATS boards report a department like "G&A" that carries
 *   no category meaning, while the title almost always does.
 * @returns A `JobCategory`. Never null or undefined.
 */
export function normalizeCategory(raw?: string | null, title?: string | null): JobCategory {
  const rawText = comparableText(raw ?? '');
  const titleText = comparableText(title ?? '');

  // The source's own category is the stronger signal, so try it alone first.
  // Checking both together would let a title word override an explicit
  // department ("Sales Engineer" in the Engineering department → engineering).
  for (const rule of RULES) if (rawText && rule.pattern.test(rawText)) return rule.category;
  for (const rule of RULES) if (titleText && rule.pattern.test(titleText)) return rule.category;
  return 'general';
}

/** Whether a string is already a valid normalized category. */
export function isJobCategory(value: unknown): value is JobCategory {
  return typeof value === 'string' && (JOB_CATEGORIES as readonly string[]).includes(value);
}
