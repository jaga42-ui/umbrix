"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console; in production this is where you'd also
    // forward to an error reporter (Sentry, etc.).
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-2xl mx-auto">
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-none text-destructive mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-destructive mb-3 font-semibold">
          System Error Encountered
        </div>
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mb-3">
          An unexpected error occurred while loading this page or querying the database. You can retry immediately, and if the problem persists please check your connection or contact support.
        </p>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground/70 font-mono mb-6 bg-surface border border-border px-3 py-1.5 rounded-none">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="um-btn um-btn--primary inline-flex items-center gap-2 px-6 py-3 rounded-none text-sm font-semibold cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </main>
      <Footer />
    </div>
  );
}
