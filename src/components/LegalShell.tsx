import Link from "next/link";

/**
 * Shared chrome for the public legal pages (privacy, terms). Plain, readable,
 * on-brand — no app header (these are reachable signed-out). Renders a title,
 * "last updated" line, the content, and cross-links between the legal pages.
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
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-lg font-mono font-semibold tracking-[0.2em]">UMBRIX</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 sm:py-16">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-2">{title}</h1>
        <p className="font-mono text-xs text-muted-foreground mb-10">Last updated: {updated}</p>

        <div className="legal-prose space-y-6 text-sm sm:text-[15px] leading-relaxed text-foreground/85">
          {children}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Umbrix</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/" className="hover:text-foreground transition-colors ml-auto">Back to Umbrix →</Link>
        </div>
      </footer>
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
