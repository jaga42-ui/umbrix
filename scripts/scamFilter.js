// Heuristic scam filter for ingested job postings.
//
// Design goals (in priority order):
//   1. Never silently drop a legitimate job. False positives are worse than
//      false negatives here — our source is already curated (official ATS
//      endpoints of real companies), so a posting that trips the filter is
//      far more likely to be a legit fintech JD mentioning "wire transfer"
//      than an actual scam. Every signal is therefore scored, not fatal:
//      one keyword can't kill a job on its own.
//   2. Catch the scam patterns that actually target Indian freshers —
//      pay-to-apply / registration fees, refundable "security deposits",
//      training-kit charges, UPI payment requests, and application funnels
//      that route to WhatsApp/Telegram or a personal Gmail instead of an ATS.
//   3. Be auditable. evaluate() returns the exact reasons a job was flagged
//      so blocked postings can be logged and reviewed — the trust moat only
//      works if we can explain every drop.
//
// A job is flagged when its weighted score reaches THRESHOLD. Tune weights
// and threshold here; behavior is pinned by scamFilter.test.js.

const THRESHOLD = 3;

// Decode the handful of HTML entities that show up in ATS content, then strip
// tags, so phrase matching works on readable text rather than raw markup.
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Each rule contributes `weight` to the score when `test` matches. Phrases are
// written to require candidate-directed money context wherever a bare term
// (e.g. "wire transfer", "fee") would otherwise fire on legit fintech copy.
const RULES = [
  // --- Candidate-directed money asks (the real killers, weight 3) ----------
  {
    // "registration/joining/interview fee" is never legitimate for a job.
    // "processing fee" and "application fee" are deliberately excluded here —
    // they're ambiguous fintech/lending product terms and are instead caught
    // by the pay-to-apply rule below only when directed at the candidate.
    weight: 3,
    reason: 'asks candidate to pay a registration / joining / interview fee',
    test: (t) =>
      /\b(registration|joining|enrol?lment|interview)\s+(fee|charges?|amount)/.test(t),
  },
  {
    // "refundable/caution deposit" is a scam tell on its own. Plain "security
    // deposit" is a real proptech/rental-fintech product term, so it only
    // counts when tied to the candidate joining/paying.
    weight: 3,
    reason: 'requires a security / refundable deposit from the candidate',
    test: (t) =>
      /\b(refundable|caution|token)\s+(deposit|amount|fee)\b/.test(t) ||
      /\bsecurity\s+deposit\b[^.]{0,40}\b(join|joining|start|before|pay|candidate|applicant|employee)/.test(
        t,
      ) ||
      /\b(pay|submit|required?)\b[^.]{0,30}\bsecurity\s+deposit\b/.test(t),
  },
  {
    // The candidate must be the one paying. "we pay a competitive salary" and
    // "Paid Media" (a job title) must NOT match — so we require an explicit
    // candidate-as-payer subject, a pay-verb bound to a scam-fee noun, or a
    // literal currency amount the candidate is asked to hand over.
    weight: 3,
    reason: 'requires the candidate to pay money',
    test: (t) =>
      // Candidate-as-payer, but the pay/transfer/deposit verb must be bound to
      // an actual money object within a short window — otherwise legit phrases
      // like "applicants must submit a resume" or "you must pay attention to
      // detail" would trip it.
      /\b(you|candidates?|applicants?|employees?|freshers?)\s+(will\s+)?(have\s+to|has\s+to|must|need\s+to|are\s+required\s+to|should)\s+(pay|transfer|deposit)\b[^.]{0,20}\b(fee|fees|amount|money|deposit|charges?|rs\.?|₹|inr|usd|\$|registration|security|caution|to\s+(join|apply|register|start|secure|confirm|receive))/.test(
        t,
      ) ||
      /\bpay\s+(a\s+|an\s+|the\s+)?(registration|processing|joining|security|training|refundable|caution|token|application|interview)\b/.test(
        t,
      ) ||
      /\bpay\s+(rs\.?|₹|inr|usd|\$)\s?\.?\s?\d/.test(t) ||
      /\bmake\s+(a\s+)?payment\s+(of|to|before)\b/.test(t),
  },
  {
    // A fee/money noun must be bound to the payment verb -- bare "pay using
    // UPI" is exactly the marketing copy a payments company (Paytm, PhonePe,
    // both real employers in our source list) uses to describe its own
    // product to consumers, not a candidate being asked to pay anything.
    weight: 3,
    reason: 'asks candidate to pay a fee via UPI / wallet',
    test: (t) =>
      /\b(pay|send|transfer|deposit)\b[^.]{0,20}\b(fee|fees|amount|money|deposit|charges?|registration|security|token)\b[^.]{0,30}\b(via|through|using|on|to)\b[^.]{0,15}\b(upi|paytm|phonepe|gpay|google\s?pay|bhim)/.test(
        t,
      ) ||
      /\b(pay|send|transfer|deposit)\b[^.]{0,15}\b(via|through|using|on|to)\b[^.]{0,15}\b(upi|paytm|phonepe|gpay|google\s?pay|bhim)\b[^.]{0,30}\b(fee|fees|amount|deposit|charges?|registration)\b/.test(
        t,
      ),
  },
  {
    // Only the candidate-facing "training/kit/onboarding FEE" scam — not
    // "training cost" / "material cost" / "course fee", which are legit budget
    // and product terms at hardware and edtech companies.
    weight: 3,
    reason: 'charges the candidate a training / kit fee',
    test: (t) =>
      /\b(training|onboarding)\s+(kit\s+)?(fee|charges)\b/.test(t) ||
      /\bkit\s+(fee|charges|amount|deposit)\b/.test(t),
  },
  {
    weight: 3,
    reason: 'bank / wire transfer tied to a fee or deposit',
    test: (t) =>
      /\b(wire|bank|money)\s+transfer\b[^.]{0,30}\b(fee|deposit|amount|registration|security|charge)/.test(
        t,
      ),
  },

  // --- Application-funnel red flags (weight 2) -----------------------------
  {
    weight: 2,
    reason: 'directs applicants to WhatsApp / Telegram with a phone number',
    test: (t) =>
      /\b(whats\s?app|telegram)\b[^.]{0,20}(\+?\d[\d\s-]{7,}|@\w+)/.test(t) ||
      /\b(contact|apply|message|reach|dm|text|ping|connect)\b[^.]{0,20}\b(whats\s?app|telegram)\b/.test(
        t,
      ),
  },
  {
    weight: 2,
    reason: 'application routed to a personal email address',
    test: (t) =>
      /\b[\w.+-]+@(gmail|yahoo|ymail|outlook|hotmail|rediffmail|rediff)\.com\b/.test(t),
  },

  // --- Too-good-to-be-true framing (weight 2) ------------------------------
  {
    weight: 2,
    reason: 'guarantees a job / placement / income with no real process',
    test: (t) =>
      /\b(100\s?%|guaranteed|assured)\s+(job|placement|selection|income|joining)/.test(t) ||
      /\bno\s+(interview|experience\s+required)\b[^.]{0,30}\b(guaranteed|assured|direct\s+joining)/.test(
        t,
      ),
  },

  // --- Weak spam signals (weight 1, only bite in combination) --------------
  {
    weight: 1,
    reason: 'high-pressure "limited seats / immediate joining" spam framing',
    test: (t) =>
      /\b(limited\s+seats|hurry\s+up|immediate\s+joining|first\s+come\s+first\s+serve)\b/.test(t),
  },
];

// A shortened or DM-routed application link is a structural red flag. A real
// posting on a company ATS links straight to that ATS, so a link shortener
// (bit.ly, …) or a route into a Telegram / WhatsApp DM is anomalous and treated
// as suspicious. Google Forms (forms.gle) is deliberately NOT here — some legit
// employers still collect applications via a Google Form, so flagging it would
// be a false positive.
const SUSPICIOUS_URL_HOST = /(?:^|\.)(bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|t\.me|wa\.me|chat\.whatsapp\.com)$/i;

// Many reputable companies include an anti-scam disclaimer in their JD, e.g.
// "we will never ask you to pay any application, processing, or training fee."
// Those sentences contain the exact scam vocabulary but *negated* — scanning
// them naively flags the honest employer. We drop any clause where a negation
// sits right before the payment language before scoring. A real scam states its
// demand in a separate, non-negated clause, so this can't mask an actual scam.
const DISCLAIMER =
  /\b(never|not|no|without|won'?t|don'?t|does\s?n'?t|do\s+not|will\s+not|free\s+of)\b[^.!?;]{0,50}\b(ask|charge|charges|charged|require|required|request|collect|seek|demand|pay|payment|fee|fees|deposit|money)/;

function stripDisclaimers(text) {
  return text
    .split(/[.!?;]+/)
    .filter((clause) => !DISCLAIMER.test(clause))
    .join('. ');
}

function evaluate({ title = '', content = '', applyUrl = '' } = {}) {
  const raw = `${title} ${stripHtml(content)}`.toLowerCase();
  const haystack = stripDisclaimers(raw);
  const reasons = [];
  let score = 0;

  for (const rule of RULES) {
    if (rule.test(haystack)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  if (applyUrl) {
    try {
      const host = new URL(applyUrl).host.toLowerCase();
      if (SUSPICIOUS_URL_HOST.test(host)) {
        score += 3;
        reasons.push(`application link points to an untrusted host (${host})`);
      }
    } catch {
      // A malformed apply URL is itself suspicious for a real ATS posting.
      score += 2;
      reasons.push('application URL is malformed');
    }
  }

  return { isScam: score >= THRESHOLD, score, reasons };
}

// Back-compat thin wrapper.
function isScam(content) {
  return evaluate({ content }).isScam;
}

module.exports = { evaluate, isScam, stripHtml, THRESHOLD };
