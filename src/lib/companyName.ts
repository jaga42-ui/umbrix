/**
 * Turning a `companySlug` into an employer name a human would recognise.
 *
 * `companyName` is absent on 2,346 live India postings, and for those the slug
 * is what the UI shows. The old rule — uppercase the first character — put
 * "Hpe", "Mongodb", "Phonepe", "Gitlab" and "Servicenow" into job cards, the
 * FAQ answers, and the city-page hiring snapshot. Wrong brand casing on the
 * pages built to win search is a small thing that reads as carelessness, and it
 * now appears in indexed prose rather than only in a card.
 *
 * There is no rule that derives "PhonePe" from "phonepe", so the exceptions are
 * listed. The list is keyed on what actually reaches the UI, ordered roughly by
 * how many live postings each covers — extend it when a new employer shows up
 * miscased rather than trying to infer camel-case from a lowercase string.
 */
const SLUG_OVERRIDES: Record<string, string> = {
  // Acronyms — the first-character rule mangles these worst.
  hpe: "HPE",
  kla: "KLA",
  cred: "CRED",
  nvidia: "NVIDIA",

  // Internal capitals.
  mongodb: "MongoDB",
  phonepe: "PhonePe",
  gitlab: "GitLab",
  servicenow: "ServiceNow",
  inmobi: "InMobi",
  highradius: "HighRadius",
  hackerrank: "HackerRank",
  zoominfo: "ZoomInfo",
  clickhouse: "ClickHouse",
  spotdraft: "SpotDraft",
  fampay: "FamPay",
  epifi: "epiFi",

  // Two words collapsed into one slug.
  khanacademy: "Khan Academy",
  abnormalsecurity: "Abnormal Security",
  freshprints: "Fresh Prints",
  observeai: "Observe.AI",

  // Deliberately lower-case brands, which the first-character rule breaks.
  ixigo: "ixigo",
};

/**
 * A display label for a company slug.
 *
 * Order matters: an explicit override wins; then a slug that already carries
 * capitals is trusted as-is (some are stored correctly, e.g. "ElevenLabs",
 * "Experian", "Swiggy") because re-casing those would only damage them; only a
 * fully lower-case slug is title-cased, splitting on hyphens and underscores so
 * a multi-word slug reads as words rather than "Tata-consultancy-services".
 *
 * @param slug the raw `companySlug` value
 */
export function labelFromSlug(slug: string): string {
  const trimmed = slug.trim();
  if (trimmed.length === 0) return "";

  const override = SLUG_OVERRIDES[trimmed.toLowerCase()];
  if (override) return override;

  // Already cased by whoever stored it — don't second-guess it.
  if (/[A-Z]/.test(trimmed)) return trimmed;

  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
