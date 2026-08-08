/**
 * Shared validation.
 *
 * Every connector needs the same baseline guarantees, and today none of them
 * check anything — a posting with an empty title or a `javascript:` apply URL
 * would be written straight to the database and rendered on a card.
 *
 * Validation returns issues rather than throwing: one malformed posting must
 * not abort a run of several hundred, and the rejected count is a health signal
 * worth recording.
 */

import type { NormalizedJob, ValidationResult, ValidationIssue } from '@umbrix/core';
import { JOB_CATEGORIES } from '@umbrix/core';

/** Only these schemes may ever reach an href. Blocks javascript:/data: XSS. */
const SAFE_URL_SCHEMES = new Set(['http:', 'https:']);

const MIN_TITLE_LENGTH = 2;
const MAX_TITLE_LENGTH = 300;

export function validateJob(job: NormalizedJob): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  const title = job.title?.trim() ?? '';
  if (title.length < MIN_TITLE_LENGTH) add('title', 'missing or too short');
  else if (title.length > MAX_TITLE_LENGTH) add('title', `longer than ${MAX_TITLE_LENGTH} characters`);

  if (!job.applyUrl) {
    add('applyUrl', 'missing');
  } else {
    try {
      const url = new URL(job.applyUrl);
      // The apply URL becomes an href users click. An unsafe scheme here is a
      // stored-XSS vector, so this is a security boundary, not a tidiness check.
      if (!SAFE_URL_SCHEMES.has(url.protocol)) add('applyUrl', `unsafe scheme "${url.protocol}"`);
    } catch {
      add('applyUrl', 'not a valid URL');
    }
  }

  if (!job.groupSlug) add('groupSlug', 'missing — reconciliation needs a grouping key');
  if (!job.sourceId) add('sourceId', 'missing');
  if (!job.location?.trim()) add('location', 'missing');

  if (!(JOB_CATEGORIES as readonly string[]).includes(job.category)) {
    add('category', `"${job.category}" is not a normalized category`);
  }

  const exp = job.eligibility.minExperience;
  if (exp !== undefined && (!Number.isFinite(exp) || exp < 0 || exp > 30)) {
    add('eligibility.minExperience', `implausible value ${exp}`);
  }
  const cgpa = job.eligibility.cgpaCutoff;
  if (cgpa !== undefined && (!Number.isFinite(cgpa) || cgpa <= 0 || cgpa > 10)) {
    add('eligibility.cgpaCutoff', `outside the 0–10 scale: ${cgpa}`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
