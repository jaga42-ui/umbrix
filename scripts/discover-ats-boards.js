/**
 * Discover which ATS (if any) hosts a candidate employer's public job board.
 *
 * Why this exists: the registry is ~84% US/global companies whose India offices
 * are a rounding error — 162 boards yield only 1,591 India jobs, and 84 of them
 * yield zero. Indian employers on the same platforms behave completely
 * differently (Paytm 217 India of 244, Meesho 47 of 48). The constraint is the
 * company list, not the ingestion method, so the highest-yield work is finding
 * Indian boards on the connectors that already exist.
 *
 * Probes every candidate against all four ATS platforms, because which one an
 * employer uses is not knowable up front, and slug spelling varies (Smart-
 * Recruiters is case-sensitive; some boards hyphenate). Only combinations that
 * return real postings are reported, and only those with India jobs are worth
 * adding.
 *
 * Read-only — touches no database. Run:
 *   node scripts/discover-ats-boards.js            # all candidates
 *   node scripts/discover-ats-boards.js --limit=40 # smoke test
 */

const { isIndiaLocation } = require('./ingest-jobs');
const existing = require('./companies.json');

const USER_AGENT = 'UmbrixBot/1.0 (+https://umbrix.vercel.app/bot)';

/**
 * Boards already in the registry, matched case-insensitively — SmartRecruiters
 * slugs preserve company casing, so "PhonePe" and "phonepe" are the same board
 * and reporting both as a find would be noise.
 */
const REGISTERED = new Set(existing.map((c) => `${c.ats}:${String(c.slug).toLowerCase()}`));

/**
 * Candidate India-hiring employers, by sector. Names only — slug spelling is
 * generated below, since the same company may be "yellowai", "yellow-ai" or
 * "YellowAI" depending on the platform.
 */
const CANDIDATES = [
  // Fintech
  'Razorpay', 'Zerodha', 'Groww', 'Upstox', 'Slice', 'Jupiter', 'Navi', 'Zeta',
  'Juspay', 'PineLabs', 'Cashfree', 'MobiKwik', 'Lendingkart', 'KreditBee',
  'MoneyView', 'INDmoney', 'Dhan', 'AngelOne', 'Fyers', 'Open', 'Decentro',
  'Setu', 'Perfios', 'Signzy', 'ClearTax', 'Zolve', 'Easebuzz', 'PayU',
  'BillDesk', 'Instamojo', 'Rupeek', 'Indifi', 'Epifi', 'CredAvenue', 'Yubi',
  // Consumer / commerce
  'Nykaa', 'Snapdeal', 'FirstCry', 'Purplle', 'Mamaearth', 'boAt', 'Licious',
  'BigBasket', 'Blinkit', 'Zepto', 'Dunzo', 'Rapido', 'Ola', 'UrbanCompany',
  'NoBroker', 'MagicBricks', 'Cars24', 'Spinny', 'CarDekho', 'Droom', 'Lenskart',
  'Wakefit', 'PepperFry', 'CountryDelight', 'Zetwerk', 'Udaan', 'Jumbotail',
  // SaaS / product
  'Zoho', 'Chargebee', 'BrowserStack', 'Postman', 'Hasura', 'MindTickle',
  'Whatfix', 'LeadSquared', 'Capillary', 'Netcore', 'CleverTap', 'MoEngage',
  'WebEngage', 'Exotel', 'Gupshup', 'Haptik', 'YellowAI', 'Uniphore',
  'ObserveAI', 'Icertis', 'Druva', 'Securonix', 'Seclore', 'Innovaccer',
  'Darwinbox', 'Keka', 'Zluri', 'Atlan', 'Rippling', 'Rocketlane', 'Fyle',
  'Kissflow', 'Freshworks', 'Sprinklr', 'Amagi', 'Eightfold', 'Sirion',
  // Edtech
  'Unacademy', 'Vedantu', 'PhysicsWallah', 'upGrad', 'Simplilearn',
  'GreatLearning', 'Scaler', 'NewtonSchool', 'CodingNinjas', 'Testbook',
  'Adda247', 'Classplus', 'Teachmint', 'Cuemath', 'Emeritus', 'Eruditus',
  'Imarticus', 'MasaiSchool', 'LEAD', 'Toppr',
  // Health
  'Practo', 'PharmEasy', 'Netmeds', 'HealthifyMe', 'Cure', 'Curefit',
  'MediBuddy', 'Plum', 'Onsurity', 'Wysa', 'Qure', 'Tata1mg',
  // Logistics / mobility
  'Delhivery', 'Shiprocket', 'EcomExpress', 'XpressBees', 'BlackBuck',
  'Porter', 'Locus', 'Shadowfax', 'LoadShare', 'ElasticRun', 'Rivigo',
  // Gaming
  'MPL', 'WinZO', 'Nazara', 'Zupee', 'Games24x7', 'JungleeGames', 'Dream11',
  // Travel
  'Goibibo', 'Ixigo', 'Cleartrip', 'OYO', 'Treebo', 'FabHotels', 'EaseMyTrip',
  // AI / data / consulting
  'Sarvam', 'Krutrim', 'Fractal', 'TheMathCompany', 'Tredence', 'Quantiphi',
  'LatentView', 'MuSigma', 'Gramener', 'AbsolutData', 'Sigmoid', 'Cognitive',
  // IT services (largest fresher hirers in India)
  'Infosys', 'TCS', 'Cyient', 'KPIT', 'SonataSoftware', 'Zensar', 'Mastek',
  'HappiestMinds', 'Newgen', 'RamcoSystems', 'IntellectDesign', 'NucleusSoftware',
  'Virtusa', 'Xoriant', 'Synechron', 'GlobalLogic', 'Thoughtworks', 'Infrrd',
  // Enterprise / GCC with large India org
  'Tekion', 'Highradius', 'Innovapptive', 'Aera', 'Netradyne', 'Uber',
  'Rubrik', 'Nutanix', 'Arista', 'Cohesity', 'Confluent', 'Salesforce',
];

/** Probe definitions. Each returns a normalized {ok, jobs:[{location}]}. */
const PROBES = {
  greenhouse: {
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    parse: (data) => (Array.isArray(data?.jobs) ? data.jobs.map((j) => ({ location: j.location?.name })) : null),
  },
  lever: {
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    parse: (data) => (Array.isArray(data) ? data.map((j) => ({ location: j.categories?.location })) : null),
  },
  ashby: {
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    parse: (data) => (Array.isArray(data?.jobs) ? data.jobs.map((j) => ({ location: j.location })) : null),
  },
  smartrecruiters: {
    url: (slug) => `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`,
    parse: (data) =>
      Array.isArray(data?.content)
        ? data.content.map((p) => ({
            location: [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(', '),
          }))
        : null,
  },
};

/**
 * Slug spellings to try for a company name. Platforms disagree: Greenhouse and
 * Lever are lowercase, SmartRecruiters preserves the company's own casing.
 */
function slugVariants(name) {
  const compact = name.replace(/[^A-Za-z0-9]/g, '');
  const hyphen = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...new Set([compact.toLowerCase(), hyphen.toLowerCase(), compact, name])];
}

async function probe(ats, slug) {
  const { url, parse } = PROBES[ats];
  try {
    const res = await fetch(url(slug), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const jobs = parse(await res.json());
    // An empty board is indistinguishable from a wrong slug for our purposes:
    // either way there is nothing to ingest, so it is not a hit.
    return jobs && jobs.length > 0 ? jobs : null;
  } catch {
    return null;
  }
}

/** Run `worker` over `items` with at most `size` in flight. */
async function pool(items, worker, size) {
  const out = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return out;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const names = limitArg ? CANDIDATES.slice(0, Number(limitArg.split('=')[1])) : CANDIDATES;

  // Every (name, ats, slug-variant) pair. Deduped so shared spellings are not
  // probed twice.
  const tasks = [];
  const seen = new Set();
  for (const name of names) {
    for (const slug of slugVariants(name)) {
      for (const ats of Object.keys(PROBES)) {
        const key = `${ats}:${slug}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push({ name, ats, slug });
      }
    }
  }

  console.error(`probing ${tasks.length} (ats, slug) pairs across ${names.length} companies...`);

  const results = await pool(
    tasks,
    async (task) => {
      const jobs = await probe(task.ats, task.slug);
      if (!jobs) return null;
      const india = jobs.filter((j) => isIndiaLocation(j.location)).length;
      return { ...task, total: jobs.length, india };
    },
    8
  );

  const hits = results.filter(Boolean);
  // One entry per company: keep the spelling with the most India jobs, so a
  // company found under several variants is added once.
  const best = new Map();
  for (const hit of hits) {
    const current = best.get(hit.name);
    if (!current || hit.india > current.india || (hit.india === current.india && hit.total > current.total)) {
      best.set(hit.name, hit);
    }
  }

  const withIndia = [...best.values()]
    .filter((h) => h.india > 0 && !REGISTERED.has(`${h.ats}:${h.slug.toLowerCase()}`))
    .sort((a, b) => b.india - a.india);
  const withoutIndia = [...best.values()].filter((h) => h.india === 0);

  console.log(`\n=== ${withIndia.length} boards WITH India jobs (add these) ===`);
  let totalIndia = 0;
  for (const h of withIndia) {
    totalIndia += h.india;
    console.log(`  { "slug": "${h.slug}", "ats": "${h.ats}" },`.padEnd(62) + `// ${h.name}: ${h.india} india / ${h.total}`);
  }
  console.log(`\nIndia jobs discovered: ${totalIndia}`);
  console.log(`Boards found but no India jobs (skip): ${withoutIndia.length}`);
  console.log(`Companies with no board on any ATS: ${names.length - best.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
