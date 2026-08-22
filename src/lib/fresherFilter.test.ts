import { test } from "node:test";
import assert from "node:assert/strict";
import { isFresherEligible, fresherEligibleConditions } from "./fresherFilter";

test("stated experience of 0 or 1 is fresher-eligible", () => {
  assert.equal(isFresherEligible({ minExperience: 0, title: "Software Engineer" }), true);
  assert.equal(isFresherEligible({ minExperience: 1, title: "Software Engineer" }), true);
});

test("a stated mid/senior requirement is never fresher-eligible", () => {
  assert.equal(isFresherEligible({ minExperience: 2, title: "Graduate Trainee" }), false);
  assert.equal(isFresherEligible({ minExperience: 5, title: "Junior Developer" }), false);
});

test("stated evidence beats the title heuristic", () => {
  // The regression this guards: 46 live postings state minExperience 0 but have
  // "Architect" or "Staff" in the title. Dropping them would discard real
  // evidence in favour of a guess.
  assert.equal(isFresherEligible({ minExperience: 0, title: "Junior Architect" }), true);
  assert.equal(isFresherEligible({ minExperience: 0, title: "Design Architect Trainee" }), true);
  assert.equal(
    isFresherEligible({ minExperience: 0, title: "Airport Ground Staff Jobs For Freshers" }),
    true
  );
  assert.equal(isFresherEligible({ minExperience: 1, title: "Team Lead" }), true);
  assert.equal(isFresherEligible({ minExperience: 0, title: "Senior Visualizer" }), true);
});

test("unstated experience with a senior title is excluded", () => {
  // The actual defect: these were all published as fresher jobs.
  for (const title of [
    "Senior Brand Designer",
    "Senior Product Manager",
    "Staff Engineer - Mobile, Desktop & KMP",
    "City Supply Head",
    "Sales Manager",
    "Sr. Associate Account Management",
    "Senior Project Manager",
    "Associate Art Director",
    "Partner Support Lead",
  ]) {
    assert.equal(
      isFresherEligible({ minExperience: undefined, title }),
      false,
      `"${title}" must not publish as a fresher job`
    );
  }
});

test("an explicit fresher signal rescues a senior-looking title", () => {
  // Without this, 16 unambiguously-junior roles would be dropped.
  for (const title of [
    "Junior Architect",
    "Product Manager-Trainee",
    "Account manager Intern",
    "Junior Program/Project Manager Intern",
    "Junior Staff Nurse, Narayana Health",
    "Assistant Manager Campus Talent Acquisition, Corporate HR",
  ]) {
    assert.equal(
      isFresherEligible({ minExperience: undefined, title }),
      true,
      `"${title}" reads junior and must survive the title filter`
    );
  }
});

test("unstated experience with an ordinary title still passes", () => {
  // The heuristic is a floor, not a ceiling — it removes what is provably
  // wrong, it does not verify what remains.
  assert.equal(isFresherEligible({ minExperience: undefined, title: "Software Engineer" }), true);
  assert.equal(isFresherEligible({ minExperience: null, title: "Data Analyst" }), true);
});

test("a missing or empty title is not treated as senior", () => {
  assert.equal(isFresherEligible({ minExperience: undefined, title: undefined }), true);
  assert.equal(isFresherEligible({ minExperience: undefined, title: "" }), true);
});

test("the Mongo conditions mirror the predicate's structure", () => {
  const conds = fresherEligibleConditions();
  assert.equal(conds.length, 2, "one guard against stated senior, one $or of the three rules");

  // The guard must be the $not form: a plain `$lte: 1` would silently drop
  // every unstated posting, and `$lt: 2` would not match a missing field.
  assert.deepEqual(conds[0], { minExperience: { $not: { $gte: 2 } } });

  const alternatives = (conds[1] as { $or: Record<string, unknown>[] }).$or;
  assert.equal(alternatives.length, 3, "stated-evidence, non-senior-title, fresher-rescue");
  // Stated evidence must exclude missing as well as null, or unstated postings
  // would satisfy the first branch and skip the title check entirely.
  assert.deepEqual(alternatives[0], { minExperience: { $ne: null, $lte: 1 } });
});
