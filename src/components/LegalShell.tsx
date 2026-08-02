import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/**
 * Shared chrome for the public legal pages (privacy, terms).
 * Renders the Modernist header, title, "last updated" line, the content, and footer.
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 sm:py-16">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          {title}
        </h1>
        <p className="font-mono text-xs text-muted-foreground mb-10">Last updated: {updated}</p>

        <div className="legal-prose space-y-6 text-sm sm:text-[15px] leading-relaxed text-foreground/85">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** A titled section within a legal page. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="font-serif text-xl tracking-tight text-foreground pt-2">{heading}</h2>
      {children}
    </section>
  );
}
