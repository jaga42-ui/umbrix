import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Umbrix collects, uses, and protects your data.",
};

const UPDATED = "25 July 2026";

const ul = "list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50";
const strong = "font-semibold text-foreground";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <p>
        Umbrix (&ldquo;Umbrix,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is a job- and internship-discovery
        platform for Indian students and fresh graduates. This policy explains what personal data we
        collect, why, who we share it with, and the choices you have. By using Umbrix you agree to this
        policy.
      </p>

      <LegalSection heading="Information we collect">
        <ul className={ul}>
          <li>
            <span className={strong}>Account details.</span> You sign in with Google. We receive your
            name, email address, profile photo, and Google account ID.
          </li>
          <li>
            <span className={strong}>Your résumé and profile.</span> When you upload a résumé (PDF), we
            extract its text to identify your skills, work and project experience, education, and the
            fields you&rsquo;re targeting. We store this parsed information as your profile. You can edit
            or remove any of it.
          </li>
          <li>
            <span className={strong}>Activity.</span> Jobs you view, save, or apply to; résumé uploads;
            and pages you visit — recorded as usage events tied to your account and an anonymous device
            identifier, so we can improve the product.
          </li>
          <li>
            <span className={strong}>Application tracker.</span> The jobs you save and the stage you set
            for each.
          </li>
          <li>
            <span className={strong}>Technical data.</span> Your IP address (used for security and rate
            limiting), device and browser information, and identifiers stored in cookies / local storage
            (your sign-in session and an anonymous analytics ID).
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use your data">
        <ul className={ul}>
          <li>Build your personalised feed and calculate a match score and explanation for each role.</li>
          <li>Run our scam filter so listings are checked before you see them.</li>
          <li>Power features you choose to use, such as AI résumé tailoring and cover letters.</li>
          <li>Send you match-alert emails — only if you opt in, and you can unsubscribe at any time.</li>
          <li>Keep the service secure and prevent abuse.</li>
          <li>Understand how the product is used, in aggregate, so we can improve it.</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </LegalSection>

      <LegalSection heading="AI processing of your résumé">
        <p>
          To read your résumé and to generate tailored résumés or cover letters, we send the relevant
          text to third-party AI providers (currently <span className={strong}>Groq</span> and{" "}
          <span className={strong}>Google (Gemini)</span>) that perform the processing on our behalf. We
          send only what&rsquo;s needed for the feature and do not use your résumé to train any model.
        </p>
      </LegalSection>

      <LegalSection heading="Service providers we share data with">
        <p>We use trusted providers to run Umbrix. They process data only to provide their service to us:</p>
        <ul className={ul}>
          <li><span className={strong}>Google Firebase</span> — sign-in / authentication.</li>
          <li><span className={strong}>MongoDB Atlas</span> — secure database for your profile and activity.</li>
          <li><span className={strong}>Groq</span> and <span className={strong}>Google (Gemini)</span> — AI résumé parsing and tailoring.</li>
          <li><span className={strong}>Vercel</span> — application hosting.</li>
          <li><span className={strong}>Upstash</span> — rate limiting / abuse prevention.</li>
          <li><span className={strong}>Resend</span> — delivery of the emails you opt into.</li>
        </ul>
        <p>
          Job listings on Umbrix come <em>from</em> third parties (company career sites and aggregators
          such as Adzuna). When you click <span className={strong}>Apply</span>, you leave Umbrix for the
          employer&rsquo;s or aggregator&rsquo;s own site, which is governed by their privacy policy — we
          don&rsquo;t submit your application or share your profile with them.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies and local storage">
        <p>
          We use only what the app needs to work: your Google sign-in session, and an anonymous
          identifier in your browser&rsquo;s local storage that lets us measure product usage. We do not
          use third-party advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep your data">
        <p>
          We keep your profile and activity while your account is active. If you ask us to delete your
          account, we remove your personal data, except where we must keep limited records to comply with
          the law or resolve disputes.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          You can access, correct, or delete your profile at any time from the Profile page, and
          unsubscribe from emails from any email or in settings. Under India&rsquo;s Digital Personal Data
          Protection Act, 2023, you also have the right to access and correct your data, to withdraw
          consent, to nominate someone to exercise your rights, and to raise a grievance. To exercise any
          of these, contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          Umbrix is intended for users who are 18 or older, or of legal working age with the consent of a
          parent or guardian. We do not knowingly collect data from children below the applicable age
          without such consent.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          We use reasonable technical and organisational measures to protect your data, including
          encrypted connections and access controls. No system is perfectly secure, but we work to keep
          your information safe and to respond quickly to any issue.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this policy as the product evolves. We&rsquo;ll change the &ldquo;last
          updated&rdquo; date above and, for significant changes, let you know in the app or by email.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          For any privacy question or request, or to reach our grievance contact, email{" "}
          <a href="mailto:privacy@umbrix.in" className="text-accent underline underline-offset-2">
            privacy@umbrix.in
          </a>
          . We aim to respond within a reasonable time and as required by law.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
