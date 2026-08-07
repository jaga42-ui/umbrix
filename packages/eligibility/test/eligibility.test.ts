import test from 'node:test';
import assert from 'node:assert';
import { extractEligibility, parseMinExperience, parseBatchYears, parseCgpa, parseBranches, isFresherTitle, mergeEligibility } from '../src/index.js';

// The regexes are ported from scripts/ingest-jobs.js; these assertions pin the
// behaviour that tuning bought, so a refactor cannot quietly undo it.

test('parseMinExperience: explicit requirements win over stray fresher words', () => {
  assert.equal(parseMinExperience('5+ years of experience required'), 5);
  assert.equal(parseMinExperience('Minimum 3 years experience'), 3);
  assert.equal(parseMinExperience('experience: 4 years'), 4);
  assert.equal(parseMinExperience('2-4 yrs experience'), 2);
});

test('parseMinExperience: company self-description does not read as a requirement', () => {
  // The precision case the original comment calls out by name.
  assert.equal(parseMinExperience('With 25+ years of excellence in manufacturing'), undefined);
  assert.equal(parseMinExperience('Founded 30 years ago'), undefined);
});

test('parseMinExperience: fresher phrasing maps to 0', () => {
  assert.equal(parseMinExperience('Freshers welcome'), 0);
  assert.equal(parseMinExperience('No prior experience required'), 0);
  assert.equal(parseMinExperience('entry-level role'), 0);
  assert.equal(parseMinExperience('0-1 years'), 0);
});

test('isFresherTitle excludes senior-modified titles', () => {
  assert.equal(isFresherTitle('Software Intern'), true);
  assert.equal(isFresherTitle('Graduate Engineer Trainee'), true);
  assert.equal(isFresherTitle('Senior Graduate Recruiter'), false);
  assert.equal(isFresherTitle('Lead Engineer'), false);
  // "Associate" is deliberately not a fresher signal — it is ambiguous.
  assert.equal(isFresherTitle('Associate Director'), false);
});

test('parseBatchYears reads both orderings', () => {
  assert.deepEqual(parseBatchYears('Batch of 2025 and 2026'), [2025, 2026]);
  assert.deepEqual(parseBatchYears('2024 & 2025 graduates'), [2024, 2025]);
  assert.deepEqual(parseBatchYears('no years here'), []);
  // Out-of-range years are ignored.
  assert.deepEqual(parseBatchYears('batch of 2019'), []);
});

test('parseCgpa stays on the 0-10 scale', () => {
  assert.equal(parseCgpa('7.5 CGPA and above'), 7.5);
  assert.equal(parseCgpa('CGPA: 8'), 8);
  assert.equal(parseCgpa('no cutoff mentioned'), undefined);
});

test('parseBranches canonicalises stream names', () => {
  assert.deepEqual(parseBranches('Open to CSE and ECE students'), ['CSE', 'ECE']);
  assert.ok(parseBranches('Computer Science graduates').includes('CSE'));
  assert.ok(parseBranches('B.Com freshers').includes('BCom'));
});

test('extractEligibility: a fresher title is authoritative over silent prose', () => {
  // The failure this prevents: a short excerpt states no years, minExperience
  // lands unstated, and the posting passes the `$not: {$gte: 2}` fresher filter
  // on the SEO pages while actually being mid-level.
  const result = extractEligibility('Marketing Intern', 'Join our team.');
  assert.equal(result.minExperience, 0);
  assert.equal(result.source, 'regex');
});

test('extractEligibility strips HTML before matching', () => {
  // Tags must not break the phrase apart: markup between the number and the
  // word "years" would otherwise hide a real experience requirement.
  assert.equal(extractEligibility('Engineer', '<p>Minimum <b>4</b> years experience</p>').minExperience, 4);
  assert.equal(extractEligibility('Engineer', '<p>Minimum 4 years experience</p>').minExperience, 4);
});

test('mergeEligibility: a stronger pass wins, a weaker one cannot overwrite', () => {
  const asserted = { minExperience: 0, source: 'source' as const };
  const guessed = { minExperience: 3, source: 'regex' as const };

  assert.equal(mergeEligibility(asserted, guessed).minExperience, 0, 'regex must not overwrite source');
  assert.equal(mergeEligibility(guessed, asserted).minExperience, 0, 'source overwrites regex');
});

test('mergeEligibility fills gaps regardless of precedence', () => {
  const merged = mergeEligibility(
    { minExperience: 0, source: 'source' },
    { cgpaCutoff: 7, source: 'regex' }
  );
  assert.equal(merged.minExperience, 0);
  assert.equal(merged.cgpaCutoff, 7, 'a weaker pass may still supply an absent field');
});
