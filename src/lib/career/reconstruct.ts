/**
 * Document reconstruction.
 *
 * Extracting text from a PDF is not the same as reading a résumé. A PDF stores
 * visual lines, so a bullet that occupies three lines on the page arrives as
 * three separate strings. Treating each as its own bullet truncates every one of
 * them at the first line break.
 *
 * That is not a theoretical concern. On a real résumé it reported "0 of 8
 * bullets contain a measurable result" for a document that plainly states "70+
 * browser-based tools", "under 2 seconds" and "within 72 hours" — because every
 * one of those figures sat on a continuation line that had been thrown away.
 * The candidate would have been told to add numbers they had already written.
 *
 * This module rebuilds the logical structure — sections, and bullets reflowed
 * back into whole sentences — before any analysis runs. Deterministic, no model.
 */

/** Characters PDF exporters use as bullet markers. */
const BULLET_MARKER = /^\s*[-•*▪·‣◦●○–—]\s+/;
/** "PROFESSIONAL SUMMARY", "TECHNICAL SKILLS" — a section heading. */
const HEADING_RE = /^[A-Z][A-Z0-9 &/,'()-]{2,48}$/;
/** "Programming Languages: JavaScript, ..." — a labelled list, not prose. */
const LABEL_VALUE_RE = /^[A-Za-z][A-Za-z'’. /&-]{0,34}:\s/;
/** A line ending mid-sentence almost certainly continues below. */
const CONTINUES_RE = /[,;:]$|\b(?:and|or|the|a|an|with|for|to|of|in|on|using|via)$/i;

export interface ReconstructedSection {
  /** Heading as printed, or "" for content before the first heading. */
  heading: string;
  /** Non-bullet prose lines in this section, reflowed. */
  paragraphs: string[];
  /** Bullets in this section, each rejoined into one logical line. */
  bullets: string[];
}

export interface ReconstructedDocument {
  sections: ReconstructedSection[];
  /** Every bullet in the document, in order. */
  bullets: string[];
  /** Headings found, in order — used to judge whether structure was detected. */
  headings: string[];
  /**
   * True when the document yielded no headings and no bullets, i.e. the text
   * layer is probably an image or the layout defeated extraction. Callers must
   * treat the result as needing verification rather than as fact.
   */
  lowConfidence: boolean;
}

/**
 * Whether `line` continues the block above rather than starting a new one.
 *
 * The test is deliberately conservative. Wrongly joining two bullets merges two
 * achievements into one sentence; wrongly splitting one loses half its evidence.
 * Both are bad, but a missed join is what produced the "0 of 8 quantified" bug,
 * so lines that clearly start something new are the only ones that break the
 * flow.
 */
function startsNewBlock(line: string, previous: string): boolean {
  if (BULLET_MARKER.test(line)) return true;
  if (HEADING_RE.test(line.trim())) return true;
  if (LABEL_VALUE_RE.test(line)) return true;
  // The previous line ended mid-clause, so this one finishes it.
  if (CONTINUES_RE.test(previous.trim())) return false;
  // A previous line ending in sentence punctuation is complete; a new
  // capitalised line after it is a new block.
  if (/[.!?]$/.test(previous.trim()) && /^[A-Z]/.test(line)) return true;
  // Otherwise a short line following an unterminated one is a wrap.
  return false;
}

/**
 * Rebuild sections, paragraphs and whole bullets from extracted text.
 *
 * @param text - Raw text from the PDF/DOCX text layer.
 */
export function reconstruct(text: string): ReconstructedDocument {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const sections: ReconstructedSection[] = [];
  const headings: string[] = [];
  let current: ReconstructedSection = { heading: "", paragraphs: [], bullets: [] };

  // The block being accumulated, and whether it is a bullet.
  let buffer = "";
  let bufferIsBullet = false;

  const flush = () => {
    const value = buffer.trim();
    if (!value) return;
    if (bufferIsBullet) current.bullets.push(value);
    else current.paragraphs.push(value);
    buffer = "";
    bufferIsBullet = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const previous = i > 0 ? lines[i - 1] : "";

    if (HEADING_RE.test(line)) {
      flush();
      // Only start a new section once the current one has content, so a
      // two-line heading does not produce an empty section between them.
      if (current.heading || current.paragraphs.length || current.bullets.length) {
        sections.push(current);
      }
      current = { heading: line, paragraphs: [], bullets: [] };
      headings.push(line);
      continue;
    }

    if (startsNewBlock(line, previous) || !buffer) {
      flush();
      bufferIsBullet = BULLET_MARKER.test(line);
      buffer = line.replace(BULLET_MARKER, "");
    } else {
      // A continuation: rejoin with a single space so the sentence reads whole
      // and any figure on this line becomes visible to the analysers.
      buffer += " " + line;
    }
  }
  flush();
  sections.push(current);

  const bullets = sections.flatMap((s) => s.bullets);
  return {
    sections: sections.filter((s) => s.heading || s.paragraphs.length || s.bullets.length),
    bullets,
    headings,
    lowConfidence: headings.length === 0 && bullets.length === 0,
  };
}

/**
 * Bullets only — the common case for analysis.
 *
 * Falls back to prose lines when a résumé uses no bullet markers at all, since
 * plenty of real documents write achievements as plain sentences.
 */
export function reconstructBullets(text: string): string[] {
  const doc = reconstruct(text);
  if (doc.bullets.length > 0) return doc.bullets;
  return doc.sections
    .flatMap((s) => s.paragraphs)
    .filter((p) => p.length >= 40 && !LABEL_VALUE_RE.test(p));
}
