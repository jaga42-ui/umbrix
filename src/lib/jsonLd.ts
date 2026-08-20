/**
 * Safe serialization for JSON-LD embedded in a `<script>` tag.
 *
 * `JSON.stringify` escapes quotes but NOT `<`, so a value containing
 * `</script>` closes the block early and everything after it is parsed as
 * markup. That is a stored-XSS vector wherever the JSON-LD carries text we
 * didn't write — and job titles, company names and full descriptions all come
 * from third-party ATS feeds and aggregators.
 *
 * Also escapes U+2028 / U+2029: both are valid inside a JSON string but are
 * line terminators in JavaScript, so a parser treating the block as script
 * breaks on them. They are built from char codes rather than written literally
 * because a regex literal cannot legally contain a line terminator.
 *
 * The result stays valid JSON, so crawlers parse it normally.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const SEPARATORS = new RegExp(`[${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, "g");

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(SEPARATORS, (c) => (c === LINE_SEPARATOR ? "\\u2028" : "\\u2029"));
}
