import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJobLocation } from "./jobLocation";

test("parseJobLocation: strips work-arrangement prefixes glued to the city", () => {
  // Found on live data: "Hybrid in Bangalore, India" was emitting
  // addressLocality "Hybrid in Bangalore", which is not an address.
  for (const raw of [
    "Hybrid in Bangalore, India",
    "Remote - Bengaluru",
    "On-site: Bengaluru",
    "In-office Bangalore",
  ]) {
    assert.equal(parseJobLocation(raw).locality, "Bengaluru", `failed for "${raw}"`);
  }
});

test("parseJobLocation: normalizes alternate spellings to one canonical city", () => {
  // Consistency across postings matters more than echoing the source string.
  assert.equal(parseJobLocation("Bangalore").locality, "Bengaluru");
  assert.equal(parseJobLocation("Bengaluru, Karnataka").locality, "Bengaluru");
  assert.equal(parseJobLocation("Gurugram, Haryana").locality, "Gurgaon");
  assert.equal(parseJobLocation("Cochin").locality, "Kochi");
});

test("parseJobLocation: keeps the source spelling for cities we don't canonicalize", () => {
  const p = parseJobLocation("Mysuru, Karnataka");
  assert.equal(p.locality, "Mysuru");
  assert.equal(p.region, "Karnataka");
  assert.equal(p.citySlug, undefined);
});

test("parseJobLocation: a hybrid role in a known city still reports remote correctly", () => {
  const p = parseJobLocation("Hybrid in Bangalore, India");
  assert.equal(p.isRemote, false, "hybrid is not remote");
  assert.equal(p.citySlug, "bengaluru");
});

test("parseJobLocation: a prefix-only string yields no locality", () => {
  assert.equal(parseJobLocation("Remote").locality, undefined);
  assert.equal(parseJobLocation("Work from home").locality, undefined);
});
