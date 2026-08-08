import test from 'node:test';
import assert from 'node:assert';
import type { FetchContext } from '@umbrix/core';
import { CONNECTORS, greenhouseConnector, leverConnector, adzunaConnector, validateJob, backoffDelay, HttpError } from '../src/index.js';

/** A context with a silent logger — normalize() must never touch the network. */
const ctx = (slug: string, config: Record<string, unknown> = {}): FetchContext => ({
  slug,
  config,
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
});

test('every connector satisfies the contract', () => {
  for (const [id, connector] of Object.entries(CONNECTORS)) {
    assert.equal(connector.id, id, 'registry key must match the connector id');
    assert.ok(Number.isInteger(connector.tier) && connector.tier >= 1, `${id}: tier must be a positive integer`);
    for (const method of ['fetch', 'normalize', 'validate', 'healthCheck'] as const) {
      assert.equal(typeof connector[method], 'function', `${id} must implement ${method}()`);
    }
  }
});

test('greenhouse normalize maps a real payload shape', () => {
  const job = greenhouseConnector.normalize(
    {
      id: 4321,
      title: 'Software Engineering Intern',
      content: '&lt;p&gt;Join us. Freshers welcome.&lt;/p&gt;',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4321',
      location: { name: 'Bengaluru, India' },
      departments: [{ name: 'Engineering' }],
      updated_at: '2026-08-01T10:00:00Z',
    },
    ctx('acme')
  );

  assert.equal(job.sourceId, 'greenhouse');
  assert.equal(job.sourceJobId, '4321');
  assert.equal(job.groupSlug, 'acme');
  assert.equal(job.type, 'internship');
  assert.equal(job.isIndia, true);
  assert.equal(job.category, 'engineering');
  assert.equal(job.eligibility.minExperience, 0, 'an intern title is fresher-eligible');
  assert.ok(!job.description.includes('<p>'), 'HTML must be stripped from the description');
});

test('greenhouse treats "No Department" as absent, falling back to the title', () => {
  const job = greenhouseConnector.normalize(
    { title: 'Financial Analyst', departments: [{ name: 'No Department' }], absolute_url: 'https://x.example/1', location: { name: 'Pune' } },
    ctx('acme')
  );
  assert.equal(job.category, 'finance');
});

test('lever uses its own commitment field for job type', () => {
  const job = leverConnector.normalize(
    {
      id: 'abc-123',
      text: 'Product Analyst',
      description: 'Work with data.',
      hostedUrl: 'https://jobs.lever.co/acme/abc-123',
      categories: { location: 'Remote', team: 'Analytics', commitment: 'Intern' },
      createdAt: 1_754_000_000_000,
    },
    ctx('acme')
  );

  // The title alone says "job"; the source's own field says internship.
  assert.equal(job.type, 'internship');
  assert.equal(job.sourceJobId, 'abc-123');
  assert.equal(job.workMode, 'remote');
  assert.ok(job.postedAt instanceof Date);
});

test('adzuna carries the real employer while grouping under its shard', () => {
  const job = adzunaConnector.normalize(
    {
      id: '999',
      title: 'Sales Executive',
      description: 'Freshers welcome.',
      redirect_url: 'https://adzuna.example/land/999',
      company: { display_name: 'Globex' },
      location: { display_name: 'Mumbai, Maharashtra' },
      category: { label: 'Sales Jobs' },
      created: '2026-08-05T00:00:00Z',
    },
    ctx('adzuna-in-sales')
  );

  assert.equal(job.companyName, 'Globex', 'the card shows the real employer');
  assert.equal(job.groupSlug, 'adzuna-in-sales', 'reconciliation groups by shard');
  assert.equal(job.category, 'sales');
  assert.equal(job.isIndia, true);
});

test('normalize is pure — same input, same output', () => {
  const raw = { id: 1, title: 'Engineer', content: 'x', absolute_url: 'https://x.example/1', location: { name: 'Pune' } };
  assert.deepEqual(greenhouseConnector.normalize(raw, ctx('a')), greenhouseConnector.normalize(raw, ctx('a')));
});

test('validateJob rejects an unsafe apply URL', () => {
  const base = greenhouseConnector.normalize(
    { title: 'Engineer', content: '', absolute_url: 'javascript:alert(1)', location: { name: 'Pune' } },
    ctx('acme')
  );
  const result = validateJob(base);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((i) => i.field === 'applyUrl'), 'unsafe scheme must be rejected');
});

test('validateJob rejects an empty title', () => {
  const result = validateJob(
    greenhouseConnector.normalize({ title: '', content: '', absolute_url: 'https://x.example/1', location: { name: 'Pune' } }, ctx('acme'))
  );
  assert.equal(result.ok, false);
});

test('validateJob accepts a well-formed posting', () => {
  const result = validateJob(
    greenhouseConnector.normalize(
      { id: 1, title: 'Backend Engineer', content: 'Build APIs.', absolute_url: 'https://x.example/1', location: { name: 'Bengaluru, India' } },
      ctx('acme')
    )
  );
  assert.equal(result.ok, true);
});

test('HttpError knows what is worth retrying', () => {
  assert.equal(new HttpError(429, 'Too Many Requests', 'u').retryable, true);
  assert.equal(new HttpError(503, 'Unavailable', 'u').retryable, true);
  // 403 is the IP-allowlist / auth case — retrying only burns quota.
  assert.equal(new HttpError(403, 'Forbidden', 'u').retryable, false);
  assert.equal(new HttpError(404, 'Not Found', 'u').retryable, false);
});

test('backoff grows and stays jittered within bounds', () => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const delay = backoffDelay(attempt, 1000);
    const ceiling = Math.min(1000 * 2 ** attempt, 30_000);
    assert.ok(delay >= ceiling * 0.5 && delay <= ceiling, `attempt ${attempt}: ${delay} outside [${ceiling / 2}, ${ceiling}]`);
  }
});
