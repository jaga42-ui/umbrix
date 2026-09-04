/**
 * FAQ block for the /jobs and /internships SEO pages. The questions are
 * templated but every answer is filled with the page's real context — field,
 * city, live count, and actual hiring companies — so each of the ~300 pages
 * reads uniquely rather than as duplicate boilerplate. Renders the visible FAQ
 * plus FAQPage JSON-LD.
 *
 * Pass `fieldInline` (from `fieldLabelInline`), never `field.toLowerCase()`:
 * lowercasing the display label turns "IT & Software" into "it & software" and
 * "HR & Recruiting" into "hr & recruiting", both in the visible copy and inside
 * the FAQPage JSON-LD that feeds rich results.
 */

import { serializeJsonLd } from "@/lib/jsonLd";
import { toProseList } from "@/lib/citySnapshot";
/**
 * "a" or "an" for a field label.
 *
 * Needed because the labels start with acronyms as often as words, and the two
 * follow different rules: an acronym is read letter by letter, so "IT" takes
 * "an" (eye-tee) and "HR" takes "an" (aitch-ar) even though I and H are not
 * both vowels. Getting this wrong is visible — the article lands in the FAQPage
 * JSON-LD that feeds rich results, not just in body copy.
 */
function indefiniteArticle(phrase: string): string {
  const first = phrase.trim().split(/\s+/)[0] ?? "";
  if (/^[A-Z]{2,}$/.test(first)) {
    // Letter names beginning with a vowel sound: A, E, F, H, I, L, M, N, O, R, S, X.
    return /^[AEFHILMNORSX]/.test(first) ? "an" : "a";
  }
  return /^[aeiou]/i.test(first) ? "an" : "a";
}

export function JobsFaq({
  field,
  fieldInline,
  city,
  total,
  companies = [],
  internships = false,
  skills = [],
  addedLastWeek = 0,
}: {
  field: string; // human label, e.g. "IT & Software"
  fieldInline?: string; // mid-sentence label, e.g. "IT & software"
  city?: string; // human label, e.g. "Bengaluru"
  total: number;
  companies?: string[];
  /** Reword for the /internships section. */
  internships?: boolean;
  /** Most-mentioned skills in this slice, from `buildCitySnapshot`. */
  skills?: string[];
  /** How many listings in this slice appeared in the last seven days. */
  addedLastWeek?: number;
}) {
  const f = fieldInline ?? field;
  const where = city ? `in ${city}` : "in India";
  const kind = internships ? "internships" : "jobs";
  const article = indefiniteArticle(f);

  const faqs: { q: string; a: string }[] = [
    {
      q: `Are these ${f} ${kind} ${where} open to freshers?`,
      a: internships
        ? `Yes. Every ${f} internship listed ${where} is open to students and freshers — no prior work experience required. Anything marked "Fresher-friendly" needs little or none.`
        : `Yes. Umbrix only lists ${f} roles ${where} that freshers can apply to — entry-level positions, internships, and jobs where the posting doesn't require prior experience. Anything marked "Fresher-friendly" needs little or no experience.`,
    },
    {
      q: `Do I need experience to apply for ${f} ${kind} ${where}?`,
      a: `Not for most of them. Every listing shows the experience it asks for, and Umbrix highlights the ones open to freshers (0–1 years). When a role needs more, we say so upfront so you don't waste an application.`,
    },
    {
      q: `How do I know ${article} ${f} ${internships ? "internship" : "job"} ${where} isn't a scam?`,
      a: `Every posting passes an automated scam filter before it appears on Umbrix. As a rule, a genuine employer never asks you to pay a fee, deposit, or "registration charge" to apply — never pay to get a job.`,
    },
  ];

  if (total > 0) {
    faqs.push({
      q: `How many ${f} ${kind} are there ${where} right now?`,
      a:
        `${total.toLocaleString("en-IN")}+ fresher-eligible ${f} ${kind} are live ${where} on Umbrix today` +
        (addedLastWeek > 0
          ? `, ${addedLastWeek.toLocaleString("en-IN")} of them posted in the last seven days`
          : "") +
        `, refreshed daily as new ones are posted and filled ones drop off.`,
    });
  }
  // The only answer whose text is genuinely this slice's rather than the
  // template's with a place name swapped in. Measured across six cities, these
  // skill lists overlap by ~2/6 — it is the cheapest real differentiation
  // available on pages that were 92-96% identical to each other.
  if (skills.length > 0) {
    faqs.push({
      q: `What skills do ${f} employers ask for ${where}?`,
      a: `Across the ${f} ${kind} live ${where} right now, the skills mentioned most often are ${toProseList(
        skills
      )}. Upload your résumé and Umbrix scores each role against the skills you already have.`,
    });
  }
  if (companies.length > 0) {
    faqs.push({
      q: `Which companies offer ${f} ${kind} ${where}?`,
      a: `Employers currently hiring ${where} include ${companies.slice(0, 3).join(", ")}, among others. Sign in to see the full list with a match score on each role.`,
    });
  }
  faqs.push({
    q: `How do I apply for ${f} ${kind} ${where}?`,
    a: `Sign in with Google and upload your résumé — Umbrix reads your skills, scores how well you fit each role, and explains why. When you find one you like, "Apply" takes you to the employer's own application page.`,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  return (
    <section aria-labelledby="faq-heading" className="border-t border-border pt-8 mb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <h2 id="faq-heading" className="font-serif text-lg tracking-tight mb-5">
        Frequently asked questions
      </h2>
      <dl className="space-y-5">
        {faqs.map((x) => (
          <div key={x.q}>
            <dt className="font-semibold text-foreground">{x.q}</dt>
            <dd className="text-sm text-muted-foreground leading-relaxed mt-1">{x.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
