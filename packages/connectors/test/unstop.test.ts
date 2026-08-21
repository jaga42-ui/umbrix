import test from 'node:test';
import assert from 'node:assert';
import type { FetchContext } from '@umbrix/core';
import { unstopConnector, CONNECTORS } from '../src/index';
import { applyUrlFor, locationFor, isIndiaFor, type UnstopOpportunity } from '../src/unstop';

/** A context with a silent logger — normalize() must never touch the network. */
const ctx = (slug: string, config: Record<string, unknown> = {}): FetchContext => ({
  slug,
  config,
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
});

/**
 * Trimmed from a real `/api/public/opportunity/search-result` response, so the
 * mapping is pinned against the shape the API actually returns rather than one
 * invented to make the test pass.
 */
const RAW: UnstopOpportunity = {
  id: 1742512,
  title: 'Executive Assistant',
  type: 'jobs',
  subtype: 'jobs',
  seo_url: 'https://unstop.com/jobs/executive-assistant-unhr-1742512',
  public_url: 'jobs/executive-assistant-unhr-1742512',
  organisation: { name: 'unHR' },
  details:
    '<p>unHR is hiring for the role of Executive Assistant! About the Company: unHR is a dynamic organization. Responsibilities: Manage the Managing Director calendar, coordinate travel, and handle confidential correspondence. Requirements: 0-1 years of experience. Strong communication skills.</p>',
  locations: [
    { city: 'Gopalpur', state: 'West Bengal', country: 'India' },
    { city: 'Jaipur', state: 'Rajasthan', country: 'India' },
  ],
  required_skills: [
    { skill_name: 'Coordination skills' },
    { skill_name: 'Calendar Management' },
  ],
  end_date: '2026-09-04T00:00:00+05:30',
  updated_at: '2026-08-21T17:55:31+05:30',
  jobDetail: { min_experience: null, max_experience: null, type: null },
};

test('unstop is registered and satisfies the connector contract', () => {
  assert.equal(CONNECTORS.unstop, unstopConnector);
  assert.equal(unstopConnector.id, 'unstop');
  assert.equal(unstopConnector.tier, 2, 'CLAUDE.md schedules Unstop in tier 2');
});

test('unstop normalize maps a real payload shape', () => {
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));

  assert.equal(job.sourceId, 'unstop');
  assert.equal(job.sourceJobId, '1742512');
  assert.equal(job.groupSlug, 'unstop-jobs');
  assert.equal(job.title, 'Executive Assistant');
  assert.equal(job.companyName, 'unHR');
  assert.equal(job.applyUrl, 'https://unstop.com/jobs/executive-assistant-unhr-1742512');
  assert.equal(job.isIndia, true);
  assert.ok(!job.description.includes('<p>'), 'HTML must be stripped from the description');
});

test('unstop keeps the full description — the reason the source exists', () => {
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  // Adzuna's 500-char cap is what this source is here to escape; a mapping that
  // silently truncated would defeat the whole point.
  assert.ok(
    job.description.length > 200,
    `description collapsed to ${job.description.length} chars`
  );
  assert.ok(job.description.includes('Responsibilities'), 'body text must survive');
});

test('unstop normalize is pure — same input, same output', () => {
  const a = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  const b = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  assert.deepEqual(a, b, 'normalize must not read the clock or randomness');
});

test('every listed city stays in the location string', () => {
  // The city pages match a regex against free-text location. Keeping only the
  // first city would hide a multi-city posting from every other city page.
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  assert.ok(job.location.includes('Gopalpur'), 'first city missing');
  assert.ok(job.location.includes('Jaipur'), 'second city missing');
});

test('locationFor falls back to India when a posting lists no address', () => {
  assert.equal(locationFor({ ...RAW, locations: [] }), 'India');
  assert.equal(locationFor({ ...RAW, locations: null }), 'India');
});

test('isIndiaFor trusts the structured country over the display string', () => {
  const abroad: UnstopOpportunity = {
    ...RAW,
    locations: [{ city: 'Berlin', state: 'Berlin', country: 'Germany' }],
  };
  assert.equal(isIndiaFor(abroad, locationFor(abroad)), false);
  assert.equal(isIndiaFor(RAW, locationFor(RAW)), true);
});

test('applyUrlFor builds an absolute URL from either form', () => {
  assert.equal(
    applyUrlFor({ seo_url: 'https://unstop.com/jobs/x-1' }),
    'https://unstop.com/jobs/x-1'
  );
  // Only the relative form present.
  assert.equal(
    applyUrlFor({ public_url: 'jobs/x-1' } as UnstopOpportunity),
    'https://unstop.com/jobs/x-1'
  );
  assert.equal(applyUrlFor({} as UnstopOpportunity), '', 'no url is empty, not a broken link');
});

test('an internship stream is fresher-eligible from source, not inference', () => {
  const intern = unstopConnector.normalize(
    { ...RAW, type: 'internships', subtype: 'internships', title: 'Marketing Associate' },
    ctx('unstop-internships')
  );
  assert.equal(intern.type, 'internship');
  assert.equal(intern.eligibility.minExperience, 0);
  // Precedence matters: a source assertion must outrank the regex guess so a
  // later weaker pass cannot overwrite it.
  assert.equal(intern.eligibility.source, 'source');
});

test('a stated min_experience outranks whatever the regex inferred', () => {
  const stated = unstopConnector.normalize(
    { ...RAW, jobDetail: { min_experience: 3 } },
    ctx('unstop-jobs')
  );
  assert.equal(stated.eligibility.minExperience, 3);
  assert.equal(stated.eligibility.source, 'source');
});

test('min_experience arriving as a string is still read', () => {
  const asString = unstopConnector.normalize(
    { ...RAW, jobDetail: { min_experience: '2' } },
    ctx('unstop-jobs')
  );
  assert.equal(asString.eligibility.minExperience, 2);
});

test('a garbage min_experience falls back rather than poisoning eligibility', () => {
  const bad = unstopConnector.normalize(
    { ...RAW, jobDetail: { min_experience: 'not a number' } },
    ctx('unstop-jobs')
  );
  // Falls through to the regex, which reads "0-1 years" from the description.
  assert.notEqual(bad.eligibility.source, 'source');
});

test('required_skills become tags without crowding out derived ones', () => {
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  assert.ok(job.tags.includes('Coordination skills'));
  assert.ok(job.tags.length <= 30, 'tag list must stay bounded');
  assert.equal(new Set(job.tags).size, job.tags.length, 'tags must be unique');
});

test('a last-modified stamp is never passed off as a publication date', () => {
  // Unstop reports no posted date. Treating updated_at as postedAt would date
  // every posting to its last edit and make stale roles look fresh.
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  assert.equal(job.postedAt, undefined);
  assert.ok(job.sourceUpdatedAt instanceof Date);
});

test('an unparseable updated_at is dropped, not stored as Invalid Date', () => {
  const job = unstopConnector.normalize({ ...RAW, updated_at: 'nonsense' }, ctx('unstop-jobs'));
  assert.equal(job.sourceUpdatedAt, undefined);
});

test('a normalized posting passes validation', () => {
  const job = unstopConnector.normalize(RAW, ctx('unstop-jobs'));
  const result = unstopConnector.validate(job);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('normalize survives an empty payload without throwing', () => {
  // A source that changes shape must degrade to a rejected posting, never crash
  // the run for every other posting in the batch.
  const job = unstopConnector.normalize({} as UnstopOpportunity, ctx('unstop-jobs'));
  assert.equal(job.title, '');
  assert.equal(job.applyUrl, '');
  assert.equal(unstopConnector.validate(job).ok, false, 'an empty posting must be rejected');
});
