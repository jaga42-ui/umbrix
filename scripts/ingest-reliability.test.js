// Offline tests for the ingest reliability helpers (withRetry + runIngestPass).
// No network or DB — the workers are mocks. Runs under `npm test`.

const test = require('node:test');
const assert = require('node:assert');
const { withRetry, runIngestPass } = require('./ingest-jobs');

test('withRetry succeeds after transient failures', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'ok';
    },
    3,
    1 // tiny backoff for the test
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3, 'failed twice then succeeded');
});

test('withRetry throws after exhausting retries', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new Error('always fails');
      },
      2,
      1
    ),
    /always fails/
  );
  assert.equal(calls, 3, 'initial attempt + 2 retries');
});

test('runIngestPass retries only failures and reports recovery', async () => {
  const attempts = {};
  // 'a' always ok; 'b' fails first then recovers; 'c' always fails.
  const worker = async (item) => {
    attempts[item] = (attempts[item] || 0) + 1;
    if (item === 'a') return { slug: item, ok: true };
    if (item === 'b') return { slug: item, ok: attempts[item] > 1 };
    return { slug: item, ok: false, phase: 'db', message: 'nope' };
  };

  const { results, retried, recovered } = await runIngestPass(['a', 'b', 'c'], worker, 2);

  assert.equal(retried, 2, 'b and c failed on the first pass');
  assert.equal(recovered, 1, 'b recovered on retry');
  assert.equal(results[0].ok, true, 'a ok');
  assert.equal(results[1].ok, true, 'b now ok');
  assert.equal(results[2].ok, false, 'c still failed');
  assert.equal(attempts['a'], 1, 'a not retried (it succeeded)');
  assert.equal(attempts['b'], 2, 'b retried once');
  assert.equal(attempts['c'], 2, 'c retried once');
});

test('runIngestPass with all successes does no retries', async () => {
  const worker = async (item) => ({ slug: item, ok: true });
  const { retried, recovered } = await runIngestPass(['x', 'y'], worker, 2);
  assert.equal(retried, 0);
  assert.equal(recovered, 0);
});
