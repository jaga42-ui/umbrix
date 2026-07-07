"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive mb-6">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground text-sm max-w-md mb-2">
        An unexpected error occurred. You can try again, and if the problem persists please
        contact support.
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground/70 font-mono mb-6">
          Reference: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 h-11 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
      >
        <RotateCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
