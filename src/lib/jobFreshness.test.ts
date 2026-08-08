import test from "node:test";
import assert from "node:assert";
import { freshnessLabel } from "./jobFreshness";

const NOW = new Date("2026-08-08T12:00:00Z").getTime();
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

test("a real publication date is used when the source gave one", () => {
  const label = freshnessLabel({ postedAt: hoursAgo(2), lastSeenAt: hoursAgo(1) }, NOW);
  assert.equal(label?.text, "Posted 2h ago");
  assert.equal(label?.tone, "fresh");
});

test("without a publication date it says 'verified', which is what we actually did", () => {
  // Every ingest run re-fetches the employer's board; a posting still listed has
  // genuinely been verified. It has NOT been shown to have been posted today.
  const label = freshnessLabel({ lastSeenAt: hoursAgo(3), createdAt: daysAgo(60) }, NOW);
  assert.equal(label?.text, "Verified today");
  assert.equal(label?.tone, "fresh");
});

test("the old bug: a 60-day-old discovery date no longer reads as 60 days stale", () => {
  // This is the production case — 78% of active postings. Confirmed live today,
  // first discovered two months ago. The card must not say "Posted 2mo ago".
  const label = freshnessLabel({ lastSeenAt: hoursAgo(6), createdAt: daysAgo(60) }, NOW);
  assert.ok(!label?.text.includes("2mo"), `must not surface the discovery date: ${label?.text}`);
  assert.ok(label?.text.startsWith("Verified"));
});

test("createdAt is never dressed up as a publication date", () => {
  const label = freshnessLabel({ createdAt: daysAgo(3) }, NOW);
  assert.equal(label?.text, "Listed 3d ago");
  assert.ok(!label?.text.includes("Posted"), "we do not know when the employer posted it");
});

test("a listing we can no longer vouch for is flagged, not shown as fresh", () => {
  const label = freshnessLabel({ lastSeenAt: daysAgo(40), createdAt: daysAgo(45) }, NOW);
  assert.equal(label?.tone, "stale");
  assert.ok(label?.text.startsWith("Not confirmed"));
});

test("staleness outranks an old publication date", () => {
  // Published long ago AND not confirmed recently: the honest headline is that
  // we no longer know it is open, not when it was published.
  const label = freshnessLabel({ postedAt: daysAgo(50), lastSeenAt: daysAgo(40) }, NOW);
  assert.equal(label?.tone, "stale");
});

test("hours are shown for very recent confirmations", () => {
  assert.equal(freshnessLabel({ lastSeenAt: hoursAgo(0) }, NOW)?.text, "Verified today");
  assert.equal(freshnessLabel({ postedAt: hoursAgo(5) }, NOW)?.text, "Posted 5h ago");
});

test("a future timestamp is not rendered as a negative age", () => {
  // Source data is not always sane; a bad postedAt must fall through rather
  // than render "Posted -3h ago".
  const label = freshnessLabel({ postedAt: new Date(NOW + 86_400_000).toISOString(), lastSeenAt: hoursAgo(1) }, NOW);
  assert.ok(label?.text.startsWith("Verified"), `got: ${label?.text}`);
});

test("missing and malformed timestamps degrade quietly", () => {
  assert.equal(freshnessLabel({}, NOW), null);
  assert.equal(freshnessLabel({ createdAt: "not-a-date" }, NOW), null);
});

test("every label carries an explanation for the tooltip", () => {
  for (const input of [{ postedAt: hoursAgo(1) }, { lastSeenAt: hoursAgo(1) }, { createdAt: daysAgo(1) }]) {
    assert.ok((freshnessLabel(input, NOW)?.detail.length ?? 0) > 20, "each label must be explainable");
  }
});
