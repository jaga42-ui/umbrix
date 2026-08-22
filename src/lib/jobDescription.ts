/**
 * Turn a posting's raw `descriptionHtml` into safe, structured blocks.
 *
 * The HTML comes from third-party ATS boards and aggregators, so it is
 * untrusted. Rather than sanitizing it and handing the result to
 * `dangerouslySetInnerHTML` — which means getting an allowlist parser exactly
 * right against mXSS and malformed markup, forever — this extracts the *text*
 * and the block structure, and the page renders React elements from it.
 *
 * Nothing from the source survives as markup, so there is no injection surface
 * at all: React escapes every string it renders. The cost is losing inline
 * formatting (bold, links) inside a description, which is a fair trade for a
 * guarantee instead of a promise.
 *
 * The raw HTML is still used verbatim for the JSON-LD `description`, where
 * schema.org permits it and `serializeJsonLd` neutralizes the script-tag break.
 *
 * Pure module — pinned by fixtures.
 */

export type DescriptionBlockKind = "heading" | "paragraph" | "listItem";

export interface DescriptionBlock {
  kind: DescriptionBlockKind;
  text: string;
}

/** Bound a pathological document; CLAUDE.md already caps stored JDs at 20k. */
const MAX_BLOCKS = 400;
const MAX_BLOCK_CHARS = 2000;

/**
 * Sentinel marking block boundaries. U+0001 is a control character that cannot
 * legally appear in HTML text, so it can never collide with real content. Built
 * from a char code so no literal control byte sits in this source file.
 */
const MARK = String.fromCharCode(1);
const MARKER_RE = new RegExp(`${MARK}([HLP])${MARK}`, "g");
const H = `${MARK}H${MARK}`;
const L = `${MARK}L${MARK}`;
const P = `${MARK}P${MARK}`;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  middot: "·",
  eacute: "é",
  reg: "®",
  copy: "©",
  trade: "™",
  deg: "°",
};

/**
 * Decode HTML entities to their characters.
 *
 * Runs *after* tags are stripped, so an encoded `&lt;script&gt;` decodes to
 * literal text rather than becoming a tag we then fail to strip.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    const token = body.toLowerCase();
    if (token.startsWith("#")) {
      const code = token.startsWith("#x")
        ? Number.parseInt(token.slice(2), 16)
        : Number.parseInt(token.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[token] ?? match;
  });
}

/**
 * Parse `descriptionHtml` into ordered blocks. Returns an empty array for
 * empty or tag-only input, which lets the page fall back rather than render a
 * blank section.
 */
export function parseDescriptionHtml(html: string): DescriptionBlock[] {
  const source = String(html ?? "");
  if (!source.trim()) return [];

  const marked = source
    // Drop script/style outright, including their contents.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Mark where each kind of block begins.
    .replace(/<\s*h[1-6]\b[^>]*>/gi, H)
    .replace(/<\s*li\b[^>]*>/gi, L)
    .replace(/<\s*br\s*\/?\s*>/gi, P)
    .replace(
      /<\/?\s*(?:p|div|section|article|ul|ol|table|tr|blockquote|h[1-6]|li)\b[^>]*>/gi,
      P
    )
    // Anything left is inline (span, b, a, img…) and carries no structure.
    .replace(/<[^>]*>/g, "");

  const blocks: DescriptionBlock[] = [];
  let kind: DescriptionBlockKind = "paragraph";
  let cursor = 0;

  const push = (raw: string, as: DescriptionBlockKind) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
    if (!text) return;
    blocks.push({ kind: as, text: text.slice(0, MAX_BLOCK_CHARS) });
  };

  for (const match of marked.matchAll(MARKER_RE)) {
    push(marked.slice(cursor, match.index), kind);
    kind = match[1] === "H" ? "heading" : match[1] === "L" ? "listItem" : "paragraph";
    cursor = match.index + match[0].length;
  }
  push(marked.slice(cursor), kind);

  return blocks;
}

/**
 * Minimum real description text before a posting is worth indexing.
 *
 * `description` is a *required* property on `JobPosting`, so a page without one
 * produces Search Console errors rather than a carousel entry. But the bar is
 * set well above "non-empty" for a second reason, measured on production:
 *
 *   description text   pages   share
 *   <300                  19    0.5%
 *   300-600            3,536   89.1%   <- one source, hard-truncated at 500
 *   600-1,200             17    0.4%
 *   1,200-3,000           92    2.3%
 *   3,000+               305    7.7%
 *
 * 89% of postings came from an aggregator that truncates every description at
 * exactly 500 characters — the median, p25 and p75 are all 500. Publishing
 * thousands of near-identically-shaped stub pages is thin content at scale, and
 * the resulting site-level quality signal would drag down the field and city
 * pages too, which are the strongest thing on the domain.
 *
 * The distribution is bimodal — a wall at 500, a gap, then real descriptions
 * from 1,700 up — so 600 is not an arbitrary line, it is the seam in the data.
 *
 * Nothing is hidden from users by this: a thin posting still renders, still
 * appears in the feed, and still links out to the employer. It just doesn't
 * enter the index until it has something unique to say. That is the same rule
 * `MIN_CITY_JOBS_TO_INDEX` already applies to thin city pages.
 *
 * This number falls as the full-description sources (SerpAPI, JSearch, company
 * ATS boards — all averaging 1,700-9,700 characters) grow their share, so the
 * indexed surface widens on its own without loosening the bar.
 */
export const MIN_INDEXABLE_DESCRIPTION_CHARS = 600;

/**
 * Whether a posting carries enough description to index and to publish
 * JobPosting markup for. Measured on the *parsed text*, not the raw HTML, so a
 * document that is 2KB of empty `<div>`s doesn't pass.
 */
export function hasIndexableDescription(html: string): boolean {
  const text = parseDescriptionHtml(html)
    .map((b) => b.text)
    .join(" ");
  return text.length >= MIN_INDEXABLE_DESCRIPTION_CHARS;
}

/**
 * A short plain-text summary for meta descriptions and card previews.
 * Trims at a word boundary so it never cuts mid-word.
 */
export function descriptionSummary(html: string, maxChars = 155): string {
  const text = parseDescriptionHtml(html)
    .filter((b) => b.kind !== "heading")
    .map((b) => b.text)
    .join(" ")
    .trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}
