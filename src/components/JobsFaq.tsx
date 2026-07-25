/**
 * FAQ block for the /jobs SEO pages. The questions are templated but every
 * answer is filled with the page's real context — field, city, live job count,
 * and actual hiring companies — so each of the ~250 pages reads uniquely rather
 * than as duplicate boilerplate. Renders the visible FAQ plus FAQPage JSON-LD.
 */
export function JobsFaq({
  field,
  city,
  total,
  companies = [],
}: {
  field: string; // human label, e.g. "IT & Software"
  city?: string; // human label, e.g. "Bengaluru"
  total: number;
  companies?: string[];
}) {
  const f = field.toLowerCase();
  const where = city ? `in ${city}` : "in India";

  const faqs: { q: string; a: string }[] = [
    {
      q: `Are these ${f} jobs ${where} open to freshers?`,
      a: `Yes. Umbrix only lists ${f} roles ${where} that freshers can apply to — entry-level positions, internships, and jobs where the posting doesn't require prior experience. Anything marked "Fresher-friendly" needs little or no experience.`,
    },
    {
      q: `Do I need experience to apply for ${f} jobs ${where}?`,
      a: `Not for most of them. Every listing shows the experience it asks for, and Umbrix highlights the ones open to freshers (0–1 years). When a role needs more, we say so upfront so you don't waste an application.`,
    },
    {
      q: `How do I know a ${f} job ${where} isn't a scam?`,
      a: `Every posting passes an automated scam filter before it appears on Umbrix. As a rule, a genuine employer never asks you to pay a fee, deposit, or "registration charge" to apply — never pay to get a job.`,
    },
  ];

  if (total > 0) {
    faqs.push({
      q: `How many fresher ${f} jobs are there ${where} right now?`,
      a: `${total.toLocaleString("en-IN")}+ fresher-eligible ${f} roles are live ${where} on Umbrix today, refreshed daily as new ones are posted and filled ones drop off.`,
    });
  }
  if (companies.length > 0) {
    faqs.push({
      q: `Which companies hire freshers for ${f} roles ${where}?`,
      a: `Employers currently hiring ${where} include ${companies.slice(0, 3).join(", ")}, among others. Sign in to see the full list with a match score on each role.`,
    });
  }
  faqs.push({
    q: `How do I apply for ${f} jobs ${where}?`,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
