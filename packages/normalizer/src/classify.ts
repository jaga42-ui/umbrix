/**
 * Opportunity-type classification and skill tagging.
 *
 * Ported from `scripts/ingest-jobs.js`, including the word-boundary matching in
 * `extractTags`. That boundary handling exists for a concrete reason recorded in
 * the original: substring matching tagged every posting containing "trAInee" or
 * "avAIlable" with the skill "AI", which then rocketed those jobs to a 99% match
 * score. The boundaries are "not an ASCII letter/digit" so keywords ending in
 * punctuation ("C++", "Node.js", "UI/UX") still match.
 */

import type { JobType } from '@umbrix/core';

const INTERNSHIP_RE = /\b(intern|internship|trainee|apprentice|articleship)\b/i;
const SCHOLARSHIP_RE = /\b(scholarship|fellowship)\b/i;
const COMPETITION_RE = /\b(hackathon|case (study )?competition|ideathon|coding challenge)\b/i;

/** Classify an opportunity from its title. */
export function classifyType(title?: string | null): JobType {
  const t = String(title ?? '');
  if (COMPETITION_RE.test(t)) return /hackathon/i.test(t) ? 'hackathon' : 'competition';
  if (SCHOLARSHIP_RE.test(t)) return 'job'; // scholarships are a category, not a type
  return INTERNSHIP_RE.test(t) ? 'internship' : 'job';
}

/** Skills worth surfacing on a card. Ported from the ingest orchestrator. */
export const SKILL_KEYWORDS = [
  'React', 'TypeScript', 'Next.js', 'Node.js', 'Python', 'Rust',
  'Go', 'Figma', 'UI/UX', 'Product Design', 'GraphQL', 'PostgreSQL',
  'Docker', 'Kubernetes', 'AWS', 'Machine Learning', 'AI', 'C++',
  'Java', 'Ruby', 'Swift', 'Kotlin', 'Frontend', 'Backend', 'Fullstack',
] as const;

const SKILL_MATCHERS = SKILL_KEYWORDS.map((keyword) => {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { keyword, re: new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i') };
});

/**
 * Tags for a posting: its category plus any recognised skills in the title or
 * description. Pure and order-stable, so fixtures pin it exactly.
 */
export function extractTags(input: { title?: string; description?: string; category?: string }): string[] {
  const tags: string[] = [];
  if (input.category) tags.push(input.category);
  const haystack = `${input.title ?? ''}\n${input.description ?? ''}`;
  for (const { keyword, re } of SKILL_MATCHERS) {
    if (re.test(haystack) && !tags.includes(keyword)) tags.push(keyword);
  }
  return tags;
}
