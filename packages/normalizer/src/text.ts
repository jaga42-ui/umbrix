/**
 * Text cleanup shared by every connector.
 *
 * This logic existed in four near-identical copies (`scripts/scamFilter.js`
 * `stripHtml`, `scripts/ingest-jobs.js` `stripTagsSimple`, and a `stripHtmlTags`
 * in each aggregator adapter), and they disagreed: two decoded HTML entities and
 * two did not. That divergence was a real defect — one source shipped ~90% of
 * its postings with raw `&nbsp;` and `&amp;` visible on the job card.
 */

/** The entities that actually appear in job feeds, plus numeric escapes. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '-', mdash: '-', hellip: '…', rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', bull: '•', middot: '·', trade: '™',
  reg: '®', copy: '©', deg: '°', eacute: 'é', nbs: ' ',
};

/** Decode HTML entities, both named and numeric (decimal and hex). */
export function decodeEntities(input: string): string {
  return String(input ?? '').replace(/&(#?[a-zA-Z0-9]+);/g, (match, code: string) => {
    const named = NAMED_ENTITIES[code.toLowerCase()];
    if (named !== undefined) return named;
    const dec = /^#(\d+)$/.exec(code);
    if (dec) return safeCodePoint(Number(dec[1]), match);
    const hex = /^#x([0-9a-fA-F]+)$/.exec(code);
    if (hex) return safeCodePoint(parseInt(hex[1], 16), match);
    return match;
  });
}

/** Guard against malformed escapes: an invalid code point must not throw. */
function safeCodePoint(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * Strip HTML to readable plain text: drop script/style bodies entirely, convert
 * block boundaries to spaces, decode entities, collapse whitespace.
 *
 * Order matters — entities are decoded AFTER tags are removed, so an encoded
 * `&lt;script&gt;` in the source text cannot become a live tag.
 */
export function stripHtml(input: string): string {
  return decodeEntities(
    String(input ?? '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse whitespace and trim, without touching markup. */
export function squish(input: string): string {
  return String(input ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate on a word boundary so a description never ends mid-word.
 * Returns text unchanged when already within the limit.
 */
export function truncateWords(input: string, maxChars: number): string {
  const text = String(input ?? '');
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** Lowercased, whitespace-collapsed form used for comparison and hashing. */
export function comparableText(input: string): string {
  return squish(String(input ?? '').toLowerCase());
}
