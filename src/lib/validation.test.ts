import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRegexTerm, optDate } from "./validation";

test("safeRegexTerm escapes metacharacters and matches literally", () => {
  assert.equal(safeRegexTerm("React"), "React");
  // A classic ReDoS pattern must be neutralized to a literal.
  const escaped = safeRegexTerm("(a+)+$")!;
  assert.ok(new RegExp(`^${escaped}$`).test("(a+)+$"), "matches the literal input");
  assert.ok(!new RegExp(escaped).test("aaaa"), "does not behave as a pattern");
});

test("safeRegexTerm: empty/absent -> undefined, length-capped", () => {
  assert.equal(safeRegexTerm(""), undefined);
  assert.equal(safeRegexTerm("   "), undefined);
  assert.equal(safeRegexTerm(null), undefined);
  assert.equal(safeRegexTerm(123), undefined);
  assert.equal(safeRegexTerm("x".repeat(500))!.length, 100);
});

test("optDate distinguishes absent, clear, and a valid date", () => {
  assert.equal(optDate(undefined, "d"), undefined); // leave unchanged
  assert.equal(optDate(null, "d"), null); // explicit clear
  assert.equal(optDate("", "d"), null); // explicit clear
  assert.ok(optDate("2026-07-20", "d") instanceof Date);
  assert.throws(() => optDate("nonsense", "d"), /valid date/);
});
