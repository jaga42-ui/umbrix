// Offline tests for eligibility extraction (minExperience is the key signal).

const test = require('node:test');
const assert = require('node:assert');
const { parseMinExperience, extractEligibility, isFresherTitle } = require('./ingest-jobs');

test('isFresherTitle: early-career titles yes, ambiguous/senior no', () => {
  for (const t of ['Software Engineering Intern', 'Junior Developer', 'Graduate Software Engineer', 'Trainee Analyst', 'New Grad Engineer', 'Apprentice Developer']) {
    assert.equal(isFresherTitle(t), true, t);
  }
  for (const t of ['Associate Product Manager', 'Associate Director', 'Senior Graduate Recruiter', 'Software Engineer', 'Staff Engineer', 'Lead Designer']) {
    assert.equal(isFresherTitle(t), false, t);
  }
});

test('extractEligibility: a fresher title forces minExperience 0', () => {
  // Body says nothing about years, but the title is clearly early-career.
  assert.equal(extractEligibility('Junior Backend Engineer', 'Build APIs.').minExperience, 0);
  assert.equal(extractEligibility('Software Engineering Intern', 'Ship features.').minExperience, 0);
  // Ambiguous "Associate" is NOT forced to fresher.
  assert.ok(!('minExperience' in extractEligibility('Associate Product Manager', 'Own the roadmap.')));
});

test('parseMinExperience: fresher / entry-level -> 0', () => {
  assert.equal(parseMinExperience('We are hiring freshers'), 0);
  assert.equal(parseMinExperience('Entry-level Software Developer'), 0);
  assert.equal(parseMinExperience('New grad role, no prior experience needed'), 0);
  assert.equal(parseMinExperience('0-2 years experience'), 0);
});

test('parseMinExperience: explicit requirement -> the number', () => {
  assert.equal(parseMinExperience('5+ years of experience required'), 5);
  assert.equal(parseMinExperience('3-5 years experience'), 3);
  assert.equal(parseMinExperience('Minimum 2 years in software'), 2);
  assert.equal(parseMinExperience('10+ years of relevant experience'), 10);
});

test('parseMinExperience: no signal / false-positive guards -> undefined', () => {
  assert.equal(parseMinExperience('Software Engineer'), undefined);
  assert.equal(parseMinExperience('We shipped this 5 years ago'), undefined); // not near "experience"
  assert.equal(parseMinExperience(''), undefined);
  // Company self-description must NOT be read as a candidate requirement (would
  // wrongly hide a fresher-eligible role) — no bare "N+ years" is trusted.
  assert.equal(parseMinExperience('a company with 25+ years of excellence'), undefined);
  assert.equal(parseMinExperience('a 20+ year old firm serving India'), undefined);
});

test('parseMinExperience: catches "yrs" / "exp" / "at least" / range shorthands', () => {
  assert.equal(parseMinExperience('3+ yrs experience'), 3);
  assert.equal(parseMinExperience('Exp: 3 yrs'), 3);
  assert.equal(parseMinExperience('At least 2 years in ops'), 2);
  assert.equal(parseMinExperience('minimum 4 yrs required'), 4);
  assert.equal(parseMinExperience('2-4 yrs'), 2); // range, precise without the word "experience"
  assert.equal(parseMinExperience('experience of 5 yrs'), 5);
});

test('parseMinExperience: broader fresher phrasings -> 0', () => {
  assert.equal(parseMinExperience('Recent graduates welcome'), 0);
  assert.equal(parseMinExperience('No work experience needed'), 0);
  assert.equal(parseMinExperience('Experience not required'), 0);
  assert.equal(parseMinExperience('0-1 yrs'), 0);
});

test('parseMinExperience: explicit experience wins over stray fresher word', () => {
  // "graduate" appears but a real 4-year requirement is stated
  assert.equal(parseMinExperience('Graduate degree preferred; 4+ years of experience'), 4);
});

test('extractEligibility: shape + batch year + cgpa', () => {
  const e = extractEligibility(
    'Software Engineer',
    '<p>2025 batch eligible. Minimum 7.5 CGPA. 0-1 years experience.</p>'
  );
  assert.equal(e.minExperience, 0);
  assert.deepEqual(e.batchYears, [2025]);
  assert.equal(e.cgpaCutoff, 7.5);
});

test('extractEligibility: omits unknown fields', () => {
  const e = extractEligibility('Senior Engineer', 'Build systems.');
  assert.deepEqual(e.batchYears, []);
  assert.ok(!('minExperience' in e));
  assert.ok(!('cgpaCutoff' in e));
});
