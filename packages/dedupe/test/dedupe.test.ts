import test from 'node:test';
import assert from 'node:assert';
import type { NormalizedJob } from '@umbrix/core';
import { dedupe, identityKey, canonicalUrl, scoreDuplicate, selectBest, DUPLICATE_THRESHOLD } from '../src/index.js';

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    sourceId: 'test',
    groupSlug: 'test-shard',
    title: 'Software Engineer',
    companyName: 'Acme Technologies Pvt Ltd',
    location: 'Bengaluru, India',
    description: 'Build things.',
    applyUrl: 'https://example.com/jobs/1',
    category: 'it',
    type: 'job',
    tags: [],
    isIndia: true,
    eligibility: { source: 'regex' },
    ...over,
  };
}

test('canonicalUrl strips tracking params and normalises the host', () => {
  assert.equal(
    canonicalUrl('https://Example.com/jobs/1?utm_source=x&gh_src=y&id=5#frag'),
    'https://example.com/jobs/1?id=5'
  );
  // A malformed URL is still usable as an opaque key rather than throwing.
  assert.equal(canonicalUrl('not a url'), 'not a url');
});

test('identityKey prefers the source job id', () => {
  assert.equal(identityKey(job({ sourceJobId: '42' })), 'src:test:42');
});

test('identityKey ignores title word order and legal suffixes', () => {
  const a = identityKey(job({ title: 'Software Engineer', companyName: 'Acme Technologies Pvt Ltd' }));
  const b = identityKey(job({ title: 'Engineer, Software', companyName: 'Acme' }));
  assert.equal(a, b);
});

test('the aggregator duplicate case collapses', () => {
  // The measured failure: one role re-listed under distinct URLs, which the
  // applyUrl upsert key could not collapse. 3 listings, 1 real job.
  const listings = [
    job({ applyUrl: 'https://agg.example/jdp/111' }),
    job({ applyUrl: 'https://agg.example/jdp/222' }),
    job({ applyUrl: 'https://agg.example/jdp/333' }),
  ];
  const { jobs, stats } = dedupe(listings);
  assert.equal(jobs.length, 1, 'three listings of one role should collapse to one');
  assert.equal(stats.exactDuplicates, 2);
});

test('different companies with the same title are NOT merged', () => {
  const { jobs } = dedupe([
    job({ companyName: 'Acme', applyUrl: 'https://a.example/1' }),
    job({ companyName: 'Globex', applyUrl: 'https://b.example/1' }),
  ]);
  assert.equal(jobs.length, 2, 'same title at different companies are different jobs');
});

test('different cities are not merged', () => {
  const { jobs } = dedupe([
    job({ location: 'Bengaluru, India', applyUrl: 'https://a.example/1' }),
    job({ location: 'Pune, India', applyUrl: 'https://a.example/2' }),
  ]);
  assert.equal(jobs.length, 2);
});

test('scoreDuplicate treats an identical canonical URL as conclusive', () => {
  const verdict = scoreDuplicate(
    job({ applyUrl: 'https://x.example/1?utm_source=a' }),
    job({ applyUrl: 'https://x.example/1?utm_source=b', companyName: 'Totally Different' })
  );
  assert.equal(verdict.confidence, 1);
});

test('near-identical titles at one company clear the threshold', () => {
  const verdict = scoreDuplicate(
    job({ title: 'Software Engineer I', applyUrl: 'https://a.example/1' }),
    job({ title: 'Software Engineer (I)', applyUrl: 'https://a.example/2' })
  );
  assert.ok(verdict.confidence >= DUPLICATE_THRESHOLD, `confidence ${verdict.confidence}`);
});

test('selectBest keeps the richest version', () => {
  const thin = job({ description: 'short', applyUrl: 'https://a.example/1' });
  const rich = job({ description: 'a much longer and more useful description', applyUrl: 'https://a.example/2' });
  assert.equal(selectBest([thin, rich]).description, rich.description);
});

test('selectBest prefers eligibility the source asserted over a guess', () => {
  const guessed = job({ description: 'a very long description '.repeat(20), applyUrl: 'https://a.example/1' });
  const asserted = job({ applyUrl: 'https://a.example/2', eligibility: { source: 'source', minExperience: 0 } });
  assert.equal(selectBest([guessed, asserted]).eligibility.source, 'source');
});

test('dedupe is deterministic', () => {
  const listings = [
    job({ applyUrl: 'https://a.example/1' }),
    job({ applyUrl: 'https://a.example/2' }),
  ];
  assert.equal(dedupe(listings).jobs[0].applyUrl, dedupe([...listings].reverse()).jobs[0].applyUrl);
});
