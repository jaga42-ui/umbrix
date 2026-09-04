import { test } from "node:test";
import assert from "node:assert/strict";
import { labelFromSlug } from "./companyName";

test("acronym brands are not sentence-cased", () => {
  // "hpe" is the highest-volume slug with no companyName: 185 live postings,
  // every one of which rendered as "Hpe".
  assert.equal(labelFromSlug("hpe"), "HPE");
  assert.equal(labelFromSlug("kla"), "KLA");
  assert.equal(labelFromSlug("cred"), "CRED");
  assert.equal(labelFromSlug("nvidia"), "NVIDIA");
});

test("internal capitals are restored", () => {
  assert.equal(labelFromSlug("mongodb"), "MongoDB");
  assert.equal(labelFromSlug("phonepe"), "PhonePe");
  assert.equal(labelFromSlug("gitlab"), "GitLab");
  assert.equal(labelFromSlug("servicenow"), "ServiceNow");
  assert.equal(labelFromSlug("inmobi"), "InMobi");
  assert.equal(labelFromSlug("highradius"), "HighRadius");
});

test("slugs that collapse two words are split", () => {
  assert.equal(labelFromSlug("khanacademy"), "Khan Academy");
  assert.equal(labelFromSlug("abnormalsecurity"), "Abnormal Security");
  assert.equal(labelFromSlug("observeai"), "Observe.AI");
});

test("deliberately lower-case brands stay lower-case", () => {
  assert.equal(labelFromSlug("ixigo"), "ixigo");
});

test("overrides are case-insensitive on the incoming slug", () => {
  assert.equal(labelFromSlug("HPE"), "HPE");
  assert.equal(labelFromSlug("PhonePe"), "PhonePe");
});

test("a slug already carrying capitals is trusted, not re-cased", () => {
  // Some rows store the display form directly; re-casing would damage them.
  assert.equal(labelFromSlug("ElevenLabs"), "ElevenLabs");
  assert.equal(labelFromSlug("Experian"), "Experian");
  assert.equal(labelFromSlug("Swiggy"), "Swiggy");
});

test("plain lower-case slugs are title-cased as before", () => {
  assert.equal(labelFromSlug("stripe"), "Stripe");
  assert.equal(labelFromSlug("meesho"), "Meesho");
  assert.equal(labelFromSlug("databricks"), "Databricks");
});

test("multi-word slugs read as words, not one hyphenated blob", () => {
  assert.equal(labelFromSlug("tata-consultancy-services"), "Tata Consultancy Services");
  assert.equal(labelFromSlug("standard_chartered"), "Standard Chartered");
  assert.equal(labelFromSlug("burns--mcdonnell"), "Burns Mcdonnell");
});

test("empty and whitespace slugs yield an empty label, never a stray capital", () => {
  assert.equal(labelFromSlug(""), "");
  assert.equal(labelFromSlug("   "), "");
});
