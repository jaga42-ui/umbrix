import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";
import { PAGE_UPDATED, updatedAsHuman } from "@/lib/contentDates";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms for using Umbrix.",
  alternates: { canonical: `${SITE}/terms` },
};

/** Shared with the sitemap so the visible date and `lastmod` cannot drift. */
const UPDATED = updatedAsHuman(PAGE_UPDATED.terms);

const ul = "list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50";
const strong = "font-semibold text-foreground";

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated={UPDATED}>
      <p>
        These terms govern your use of Umbrix. By using the service you agree to them. If you don&rsquo;t
        agree, please don&rsquo;t use Umbrix.
      </p>

      <LegalSection heading="What Umbrix is">
        <p>
          Umbrix is a <span className={strong}>discovery platform</span>. We gather public job and
          internship listings from company career pages, aggregators (such as Adzuna), and similar
          sources, and help you find roles you&rsquo;re eligible for. We are{" "}
          <span className={strong}>not an employer, recruiter, or hiring agent</span>, and we do not
          guarantee a job, an interview, a response, or any outcome.
        </p>
      </LegalSection>

      <LegalSection heading="Who can use Umbrix">
        <p>
          You must be 18 or older, or of legal working age with a parent or guardian&rsquo;s consent, and
          the information you give us (including your résumé) must be accurate and your own.
        </p>
      </LegalSection>

      <LegalSection heading="Job listings come from third parties">
        <p>
          Listings originate from third parties and may be inaccurate, out of date, already filled, or
          removed at any time. When you click <span className={strong}>Apply</span>, you leave Umbrix and
          continue on the employer&rsquo;s or aggregator&rsquo;s own site. Any application, communication,
          or dealing with an employer is strictly between you and them.
        </p>
      </LegalSection>

      <LegalSection heading="Scam checks are best-effort, not a guarantee">
        <p>
          We run an automated scam filter and label listings that pass it, but this is a{" "}
          <span className={strong}>best-effort screen, not a guarantee</span> that a listing or employer
          is genuine. Always use your own judgment. In particular:
        </p>
        <ul className={ul}>
          <li>Umbrix never charges you to view or apply to a job.</li>
          <li>
            A legitimate employer will not ask you to pay a fee, deposit, or &ldquo;registration
            charge&rdquo; to apply or be hired. <span className={strong}>Never pay to get a job.</span>
          </li>
          <li>Don&rsquo;t share bank details, OTPs, or documents beyond what a normal application needs.</li>
        </ul>
        <p>Report anything suspicious to us and we&rsquo;ll review it.</p>
      </LegalSection>

      <LegalSection heading="AI features are assistive">
        <p>
          Match scores, résumé tailoring, and cover letters are AI-assisted tools provided &ldquo;as
          is&rdquo; to help you — they can make mistakes. Review and edit anything before you rely on it or
          send it to an employer.
        </p>
      </LegalSection>

      <LegalSection heading="Using Umbrix responsibly">
        <p>You agree not to:</p>
        <ul className={ul}>
          <li>Scrape, copy, or resell Umbrix&rsquo;s listings or data, or overload the service.</li>
          <li>Use Umbrix for anything unlawful, or misrepresent your identity.</li>
          <li>Interfere with the security or normal operation of the service.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Fees">
        <p>
          The core Umbrix feed is free to use. Some features may require a paid plan in the future; if so,
          the price and terms will be shown clearly before you pay.
        </p>
      </LegalSection>

      <LegalSection heading="Our content">
        <p>
          The Umbrix name, design, and software are ours (or our licensors&rsquo;) and are protected by
          law. Job listings belong to their respective sources. You keep ownership of the résumé and
          information you provide, and you grant us permission to use it to operate the service for you as
          described in our{" "}
          <a href="/privacy" className="text-accent underline underline-offset-2">Privacy Policy</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimer and liability">
        <p>
          Umbrix is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
          kind. To the fullest extent permitted by law, Umbrix is not liable for any indirect or
          consequential loss, or for outcomes arising from third-party listings, employers, or your
          reliance on AI-assisted features.
        </p>
      </LegalSection>

      <LegalSection heading="Ending your use">
        <p>
          You can stop using Umbrix and delete your account at any time. We may suspend or end access if
          these terms are broken or to protect the service and its users.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We may update these terms as the product changes. We&rsquo;ll update the &ldquo;last
          updated&rdquo; date above, and continued use after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of India have jurisdiction over
          any dispute relating to Umbrix.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:support@umbrix.in" className="text-accent underline underline-offset-2">
            support@umbrix.in
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
