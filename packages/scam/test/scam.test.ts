import test from 'node:test';
import assert from 'node:assert';
import { assessScam, isPublishable, BLOCK_THRESHOLD, SUSPICIOUS_THRESHOLD } from '../src/index.js';

// These assert the WRAPPER's grading, not the heuristics themselves — those are
// owned by scripts/scamFilter.js and pinned by scripts/scamFilter.test.js.

test('a clean posting is safe and publishable', () => {
  const result = assessScam({
    title: 'Backend Engineer',
    description: 'Build APIs with Node.js. Competitive salary.',
    applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
  });
  assert.equal(result.verdict, 'safe');
  assert.equal(isPublishable(result), true);
});

test('a pay-to-apply posting is blocked and never publishable', () => {
  const result = assessScam({
    title: 'Data Entry Job',
    description: 'Pay a registration fee of Rs 500 to confirm your seat. Refundable security deposit required.',
    applyUrl: 'https://wa.me/919999999999',
  });
  assert.equal(result.verdict, 'blocked');
  assert.equal(isPublishable(result), false);
  assert.ok(result.reasons.length > 0, 'a block must be explainable');
});

test('the suspicious band exists between clean and blocked', () => {
  assert.ok(SUSPICIOUS_THRESHOLD < BLOCK_THRESHOLD, 'there must be a reviewable middle band');
});

test('a suspicious posting still ships, flagged', () => {
  // Graded output is the point: a binary filter would either drop this or
  // record nothing about it.
  const result = assessScam({
    title: 'Work From Home Typing Job',
    description: 'Contact us on WhatsApp for details.',
    applyUrl: 'https://example.com/apply',
  });
  if (result.verdict === 'suspicious') {
    assert.equal(isPublishable(result), true, 'suspicious is flagged, not hidden');
    assert.ok(result.score >= SUSPICIOUS_THRESHOLD && result.score < BLOCK_THRESHOLD);
  }
});

test('assessScam is pure — same input, same verdict', () => {
  const input = { title: 'Engineer', description: 'Build things.', applyUrl: 'https://x.example/1' };
  assert.deepEqual(assessScam(input), assessScam(input));
});
