/**
 * Location normalization.
 *
 * `isIndia` drives the feed's default filter and the `{status, isIndia,
 * createdAt}` index, so its behaviour is load-bearing and is ported verbatim
 * from `scripts/ingest-jobs.js` — including the word boundaries, which stop
 * "India" matching "Indiana" and "Indianapolis".
 *
 * City extraction is new. The `/jobs/<field>/<city>` pages currently match
 * cities by substring against the raw location string, so "Bangalore" and
 * "Bengaluru" are different places and a job tagged one way is invisible to the
 * other. Canonicalising here fixes that at ingest instead of at query time.
 */

/** Canonical city name keyed by every spelling seen in the wild. */
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru', bengaluru: 'Bengaluru', blr: 'Bengaluru',
  bombay: 'Mumbai', mumbai: 'Mumbai',
  'new delhi': 'Delhi', delhi: 'Delhi', ncr: 'Delhi',
  gurgaon: 'Gurugram', gurugram: 'Gurugram',
  noida: 'Noida', ghaziabad: 'Ghaziabad', faridabad: 'Faridabad',
  hyderabad: 'Hyderabad', secunderabad: 'Hyderabad', cyberabad: 'Hyderabad',
  madras: 'Chennai', chennai: 'Chennai',
  calcutta: 'Kolkata', kolkata: 'Kolkata',
  pune: 'Pune', pimpri: 'Pune',
  ahmedabad: 'Ahmedabad', gandhinagar: 'Gandhinagar', 'gift city': 'Gandhinagar',
  jaipur: 'Jaipur', kochi: 'Kochi', cochin: 'Kochi', ernakulam: 'Kochi',
  chandigarh: 'Chandigarh', mohali: 'Chandigarh',
  indore: 'Indore', coimbatore: 'Coimbatore',
  thiruvananthapuram: 'Thiruvananthapuram', trivandrum: 'Thiruvananthapuram',
  mysore: 'Mysuru', mysuru: 'Mysuru',
  nagpur: 'Nagpur', visakhapatnam: 'Visakhapatnam', vizag: 'Visakhapatnam',
  vadodara: 'Vadodara', baroda: 'Vadodara', surat: 'Surat',
  lucknow: 'Lucknow', bhubaneswar: 'Bhubaneswar', bhopal: 'Bhopal',
  nashik: 'Nashik', rajkot: 'Rajkot', patna: 'Patna', kanpur: 'Kanpur',
};

/**
 * India + major Indian metros. Ported from `scripts/ingest-jobs.js` — the flag
 * it produces is indexed and filtered on, so it must keep matching identically.
 */
export const INDIA_LOCATION_REGEX =
  /\b(india|bharat|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|hyderabad|chennai|pune|noida|kolkata|ahmedabad|jaipur|kochi|cochin|chandigarh|indore|coimbatore|thiruvananthapuram|trivandrum|mysore|mysuru|nagpur|visakhapatnam|vadodara|surat|gandhinagar|gift city)\b/i;

/** Whether a location string denotes India (or a major Indian city). */
export function isIndiaLocation(location?: string | null): boolean {
  return INDIA_LOCATION_REGEX.test(String(location ?? ''));
}

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere|distributed)\b/i;
const HYBRID_RE = /\b(hybrid|flexible|partially remote)\b/i;

/** Work arrangement stated in a location or title string. */
export function detectWorkMode(...texts: (string | null | undefined)[]): 'onsite' | 'remote' | 'hybrid' | undefined {
  const joined = texts.filter(Boolean).join(' ');
  if (!joined) return undefined;
  // Hybrid is checked first: "Hybrid - Remote friendly" is hybrid, not remote.
  if (HYBRID_RE.test(joined)) return 'hybrid';
  if (REMOTE_RE.test(joined)) return 'remote';
  return undefined; // "onsite" is not asserted from silence.
}

/**
 * Canonical Indian city named in a location string, if any.
 *
 * Longest alias first, so "new delhi" is not shadowed by "delhi" — otherwise
 * both map to Delhi anyway, but the same hazard is real for future aliases
 * where the canonical target differs.
 */
const ALIASES_BY_LENGTH = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);

export function extractCity(location?: string | null): string | undefined {
  const text = String(location ?? '').toLowerCase();
  if (!text) return undefined;
  for (const alias of ALIASES_BY_LENGTH) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      return CITY_ALIASES[alias];
    }
  }
  return undefined;
}

/**
 * Tidy a location for display: collapse whitespace, drop duplicated segments,
 * and cap length. Falls back to "India" only when the string is empty, never
 * inventing a country for a location that named somewhere else.
 */
export function normalizeLocation(location?: string | null, fallback = 'India'): string {
  const raw = String(location ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return fallback;
  const seen = new Set<string>();
  const parts = raw
    .split(/\s*[,|/]\s*/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return parts.join(', ').slice(0, 200) || fallback;
}
