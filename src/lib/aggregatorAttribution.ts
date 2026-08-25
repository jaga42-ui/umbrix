/**
 * Attribution required by the feeds Umbrix ingests from.
 *
 * ## Why this exists
 *
 * Adzuna's API terms require every displayed advert to be labelled:
 *
 * > "An API user shall label each displayed advert with the phrase 'Jobs by
 * > Adzuna' at least 116 X 23 pixels in size, wherein the word 'Jobs' shall be
 * > hyperlinked to http://www.adzuna.co.uk **or the relevant local domain** and
 * > the word 'Adzuna' shall be the Adzuna Logo Image and shall also be
 * > hyperlinked to http://www.adzuna.co.uk or the relevant local domain."
 *
 * No attribution was rendered anywhere on the site. `JobCard` has carried a
 * documented `source` prop for this since it was written, but no caller ever
 * passed it, so the badge never appeared. That is a live breach of the same
 * agreement whose other clause blocks the description backfill — and the
 * penalty named in those terms is immediate revocation of API access.
 *
 * That is not a small exposure: Adzuna supplies 79% of fresher-eligible
 * listings and 64% of all active India listings. Losing the key would empty
 * most of the feed.
 *
 * ## Detection
 *
 * Keyed off the apply URL's host, not `sourceId`. Adzuna-ingested documents
 * carry no `sourceId` at all (3,745 of them), so the host is the only reliable
 * signal — and it is also the honest one: what needs labelling is an advert
 * whose apply link routes through the aggregator.
 *
 * Pure module — no network, no clock.
 */

export interface Attribution {
  /** Aggregator name, e.g. "Adzuna". */
  name: string;
  /** Where the attribution links, per that aggregator's terms. */
  href: string;
  /**
   * True when the aggregator's terms *require* the label rather than merely
   * permitting it. Required labels must render even in compact layouts.
   */
  required: boolean;
}

/**
 * The local Adzuna domain for this market. The terms allow "the relevant local
 * domain", and every ingested apply URL already points at www.adzuna.in, so
 * .in is the domain Adzuna themselves route this traffic through.
 */
const ADZUNA_IN = "https://www.adzuna.in";

/** Host substring → attribution. Ordered by specificity; first match wins. */
const RULES: { match: string; attribution: Attribution }[] = [
  { match: "adzuna.", attribution: { name: "Adzuna", href: ADZUNA_IN, required: true } },
];

/**
 * The attribution an advert must display, or null when it needs none.
 *
 * Direct ATS links (Greenhouse, Lever, Workday, SmartRecruiters) carry no such
 * requirement — the apply link goes straight to the employer, with no
 * aggregator in between to credit.
 *
 * @param applyUrl the listing's original apply URL
 */
export function attributionFor(applyUrl: string | null | undefined): Attribution | null {
  if (!applyUrl) return null;
  let host: string;
  try {
    host = new URL(applyUrl).hostname.toLowerCase();
  } catch {
    // A malformed URL is not evidence of anything; label nothing rather than
    // guessing from a substring match on arbitrary text.
    return null;
  }
  for (const rule of RULES) {
    if (host.includes(rule.match)) return rule.attribution;
  }
  return null;
}
