import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDescriptionHtml,
  decodeEntities,
  descriptionSummary,
  hasIndexableDescription,
  MIN_INDEXABLE_DESCRIPTION_CHARS,
} from "./jobDescription";

test("parseDescriptionHtml: preserves headings, paragraphs and list items", () => {
  const blocks = parseDescriptionHtml(
    "<h2>About the role</h2><p>Join us.</p><ul><li>React</li><li>TypeScript</li></ul>"
  );
  assert.deepEqual(blocks, [
    { kind: "heading", text: "About the role" },
    { kind: "paragraph", text: "Join us." },
    { kind: "listItem", text: "React" },
    { kind: "listItem", text: "TypeScript" },
  ]);
});

test("parseDescriptionHtml: drops script and style content entirely", () => {
  const blocks = parseDescriptionHtml(
    "<p>Real text</p><script>alert(1)</script><style>.x{color:red}</style>"
  );
  assert.deepEqual(blocks, [{ kind: "paragraph", text: "Real text" }]);
});

test("parseDescriptionHtml: no markup from the source survives as markup", () => {
  // The guarantee this module exists for: whatever an ATS feed sends, the
  // output is text that React will escape, never markup.
  const hostile =
    `<p onclick="steal()">Hi</p><img src=x onerror=alert(1)><iframe src="//evil"></iframe><a href="javascript:alert(1)">click</a>`;
  for (const block of parseDescriptionHtml(hostile)) {
    assert.ok(!/[<>]/.test(block.text), `block leaked markup characters: ${block.text}`);
  }
});

test("parseDescriptionHtml: an encoded tag decodes to literal text, not a tag", () => {
  // Entities are decoded AFTER tags are stripped, so this can't round-trip
  // back into live markup.
  const blocks = parseDescriptionHtml("<p>Use &lt;script&gt; carefully</p>");
  assert.deepEqual(blocks, [{ kind: "paragraph", text: "Use <script> carefully" }]);
});

test("parseDescriptionHtml: br and div boundaries split paragraphs", () => {
  const blocks = parseDescriptionHtml("First line<br>Second line<div>Third</div>");
  assert.deepEqual(
    blocks.map((b) => b.text),
    ["First line", "Second line", "Third"]
  );
});

test("parseDescriptionHtml: collapses whitespace and drops empty blocks", () => {
  const blocks = parseDescriptionHtml("<p>  spaced   out  </p><p></p><p>   </p>");
  assert.deepEqual(blocks, [{ kind: "paragraph", text: "spaced out" }]);
});

test("parseDescriptionHtml: empty and tag-only input yields no blocks", () => {
  assert.deepEqual(parseDescriptionHtml(""), []);
  assert.deepEqual(parseDescriptionHtml("   "), []);
  assert.deepEqual(parseDescriptionHtml("<div><p></p></div>"), []);
});

test("parseDescriptionHtml: plain text with no tags is still a block", () => {
  assert.deepEqual(parseDescriptionHtml("Just plain text."), [
    { kind: "paragraph", text: "Just plain text." },
  ]);
});

test("decodeEntities: handles named, decimal and hex forms", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(decodeEntities("&#8377;15,000"), "₹15,000");
  assert.equal(decodeEntities("&#x20B9;15,000"), "₹15,000");
  assert.equal(decodeEntities("caf&eacute;"), "café");
});

test("decodeEntities: leaves an unknown entity untouched rather than mangling it", () => {
  assert.equal(decodeEntities("&notarealentity;"), "&notarealentity;");
  assert.equal(decodeEntities("100 &#0; nulls"), "100 &#0; nulls");
});

test("descriptionSummary: trims at a word boundary and skips headings", () => {
  const summary = descriptionSummary(
    "<h2>About</h2><p>We are hiring a backend engineer to build payment systems at scale.</p>",
    40
  );
  assert.ok(summary.length <= 41, "should respect the cap (plus the ellipsis)");
  assert.ok(!summary.startsWith("About"), "headings are navigation, not summary text");
  assert.ok(!/\s\S+…$/.test(summary) || summary.endsWith("…"));
});

test("descriptionSummary: returns the whole text when it already fits", () => {
  assert.equal(descriptionSummary("<p>Short one.</p>", 100), "Short one.");
});

test("hasIndexableDescription: the gate sits above the aggregator truncation point", () => {
  // 89% of postings come from a source that hard-truncates at exactly 500
  // characters. The gate has to sit above that or it lets every stub through.
  assert.ok(
    MIN_INDEXABLE_DESCRIPTION_CHARS > 500,
    "a gate at or below 500 would admit every truncated aggregator stub"
  );
});

test("hasIndexableDescription: a 500-char truncated stub is not indexable", () => {
  const stub = `<p>${"a".repeat(500)}</p>`;
  assert.equal(hasIndexableDescription(stub), false);
});

test("hasIndexableDescription: a real job description is indexable", () => {
  const real = `<p>${"word ".repeat(400)}</p>`; // ~2000 chars, typical of ATS sources
  assert.equal(hasIndexableDescription(real), true);
});

test("hasIndexableDescription: measures parsed text, not raw markup", () => {
  // The failure this guards: a document padded with empty markup passing a
  // raw-length check while having nothing to actually read.
  const padded = `${"<div></div>".repeat(200)}<p>Short.</p>`;
  assert.ok(padded.length > MIN_INDEXABLE_DESCRIPTION_CHARS, "raw markup is long");
  assert.equal(hasIndexableDescription(padded), false, "but there is no real text");
});

test("hasIndexableDescription: empty and missing descriptions are not indexable", () => {
  assert.equal(hasIndexableDescription(""), false);
  assert.equal(hasIndexableDescription("   "), false);
  assert.equal(hasIndexableDescription("<div><p></p></div>"), false);
});
