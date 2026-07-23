// Offline contract tests for the source adapters. Each file under
// scripts/adapters/ must export { ats:string, tier:number, fetch:function } so
// the orchestrator can build its ATS_FETCHERS / TIER_BY_ATS maps from them. No
// network — fetch functions are not called. Runs under `npm test`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ADAPTERS_DIR = path.join(__dirname, 'adapters');
const files = fs
  .readdirSync(ADAPTERS_DIR)
  .filter((f) => f.startsWith('ingest-') && f.endsWith('.js'));

test('there is at least one adapter file', () => {
  assert.ok(files.length > 0, 'expected scripts/adapters/ingest-*.js files');
});

for (const file of files) {
  const mod = require(path.join(ADAPTERS_DIR, file));

  test(`${file}: exports the { ats, tier, fetch } contract`, () => {
    assert.equal(typeof mod.ats, 'string', 'ats must be a string');
    assert.ok(mod.ats.length > 0, 'ats must be non-empty');
    assert.ok(Number.isInteger(mod.tier) && mod.tier >= 1, 'tier must be a positive integer');
    assert.equal(typeof mod.fetch, 'function', 'fetch must be a function');
  });

  test(`${file}: filename matches its ats identifier`, () => {
    // ingest-greenhouse.js -> greenhouse. Keeps the file map self-consistent.
    const stem = file.replace(/^ingest-/, '').replace(/\.js$/, '');
    assert.equal(stem, mod.ats, `${file} should declare ats "${stem}"`);
  });
}

test('adapter ats identifiers are unique (no map collisions)', () => {
  const ids = files.map((f) => require(path.join(ADAPTERS_DIR, f)).ats);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ats identifier across adapters');
});
