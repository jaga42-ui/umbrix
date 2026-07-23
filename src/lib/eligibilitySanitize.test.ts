import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEligibility, assembleResults } from "./eligibilitySanitize";

test("sanitizeEligibility: clamps minExperience and drops out-of-range/garbage", () => {
  assert.equal(sanitizeEligibility({ minExperience: 3 }).minExperience, 3);
  assert.equal(sanitizeEligibility({ minExperience: 2.6 }).minExperience, 3, "rounds");
  assert.equal(sanitizeEligibility({ minExperience: 0 }).minExperience, 0, "fresher kept");
  assert.ok(!("minExperience" in sanitizeEligibility({ minExperience: 40 })), "40 > 30 dropped");
  assert.ok(!("minExperience" in sanitizeEligibility({ minExperience: -1 })), "negative dropped");
  assert.ok(!("minExperience" in sanitizeEligibility({ minExperience: null })), "null omitted");
});

test("sanitizeEligibility: batchYears filtered, de-duped, sorted", () => {
  const e = sanitizeEligibility({ batchYears: [2026, 2019, 2025, 2025, 2031] });
  assert.deepEqual(e.batchYears, [2025, 2026], "keeps only 2020-2030, unique, sorted");
});

test("sanitizeEligibility: branches trimmed, non-empty, capped at 12", () => {
  const e = sanitizeEligibility({ branches: ["  CSE ", "", "ECE", ...Array(20).fill("Mech")] });
  assert.equal(e.branches[0], "CSE");
  assert.ok(!e.branches.includes(""), "empties dropped");
  assert.ok(e.branches.length <= 12, "capped");
});

test("sanitizeEligibility: cgpa only on a valid 0-10 scale", () => {
  assert.equal(sanitizeEligibility({ cgpaCutoff: 7.5 }).cgpaCutoff, 7.5);
  assert.ok(!("cgpaCutoff" in sanitizeEligibility({ cgpaCutoff: 0 })), "0 dropped");
  assert.ok(!("cgpaCutoff" in sanitizeEligibility({ cgpaCutoff: 85 })), "percentage-like dropped");
  assert.ok(!("cgpaCutoff" in sanitizeEligibility({ cgpaCutoff: null })), "null omitted");
});

test("assembleResults: keeps requested ids only (hallucination guard)", () => {
  const map = assembleResults(
    ["a", "b"],
    [
      { id: "a", minExperience: 2, batchYears: [], branches: [], cgpaCutoff: null },
      { id: "zzz", minExperience: 5, batchYears: [], branches: [], cgpaCutoff: null }, // not requested
    ]
  );
  assert.ok(map.has("a"));
  assert.ok(!map.has("zzz"), "invented id dropped");
  assert.equal(map.get("a")?.minExperience, 2);
});

test("assembleResults: first result wins on a duplicate id, missing ids simply absent", () => {
  const map = assembleResults(
    ["a", "b"],
    [
      { id: "a", minExperience: 1, batchYears: [], branches: [], cgpaCutoff: null },
      { id: "a", minExperience: 9, batchYears: [], branches: [], cgpaCutoff: null },
    ]
  );
  assert.equal(map.get("a")?.minExperience, 1, "first kept");
  assert.ok(!map.has("b"), "omitted by the model → absent (caller treats as processed)");
});
