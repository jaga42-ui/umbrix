import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-2xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-accent mb-3 font-semibold">
          Error 404 / Page Not Found
        </div>
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Coordinates unknown.
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-md mb-8">
          The page or opportunity you are looking for has been moved, closed, or never existed in this sector.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="um-btn um-btn--primary inline-flex items-center gap-2 px-6 py-3 rounded-none text-sm font-semibold"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to landing
          </Link>
          <Link
            href="/feed"
            className="um-btn um-btn--secondary inline-flex items-center gap-2 px-6 py-3 rounded-none text-sm font-semibold"
            style={{ textDecoration: "none" }}
          >
            <Compass className="w-4 h-4" />
            Open Daily Discovery
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
