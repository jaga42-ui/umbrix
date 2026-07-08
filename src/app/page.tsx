"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, MapPin } from "lucide-react";

export default function LandingPage() {
  const { user, loading, signInWithGoogle, isDemoMode } = useAuth();
  const router = useRouter();

  // Today's digest date, formatted the way it'll actually read to an Indian
  // user (DD.MM.YYYY) -- a real fact about the feed, not a decorative label.
  const issueDate = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }, []);

  useEffect(() => {
    if (user && !loading) {
      router.push("/feed");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Loading&hellip;</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 md:py-20 w-full grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-14 md:gap-10 items-center">
          {/* Left: the pitch */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              Daily digest &mdash; {issueDate}
            </div>

            <h1 className="font-serif text-5xl sm:text-6xl md:text-[4.25rem] leading-[1.05] tracking-tight mb-6 text-balance">
              Every dream deserves a chance.
            </h1>

            <p className="text-xl text-foreground/80 mb-2 leading-relaxed">
              Stop searching everywhere. Start searching once.
            </p>

            <p className="text-base text-muted-foreground mb-10 max-w-md leading-relaxed">
              We pull roles straight from company ATS systems, run every one through
              a scam filter, and show you what&rsquo;s real. Nothing else.
            </p>

            <div className="space-y-3">
              <button
                onClick={signInWithGoogle}
                className="group inline-flex items-center gap-2.5 bg-primary text-primary-foreground h-12 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                <span>{isDemoMode ? "Sign in as guest developer" : "Sign in with Google"}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              {isDemoMode && (
                <p className="text-xs font-mono text-muted-foreground/80">
                  No database or Firebase setup required &mdash; try it instantly.
                </p>
              )}
            </div>
          </motion.div>

          {/* Right: a live sample of what "verified" actually looks like */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
            className="relative"
          >
            <div className="relative bg-card border border-border rounded-2xl p-6 max-w-sm mx-auto md:mx-0">
              <div
                className="stamp-mark pointer-events-none absolute top-4 right-4 w-16 h-16 rounded-full border-2 border-double border-accent/70 flex items-center justify-center rotate-[-8deg]"
                aria-hidden="true"
              >
                <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-accent text-center leading-tight px-1">
                  Verified
                  <br />
                  No Scams
                </span>
              </div>

              <div className="font-mono text-2xl font-semibold text-stage-interview mb-1">92%</div>
              <div className="font-mono text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-4">
                Match
              </div>

              <h3 className="text-lg font-semibold tracking-tight mb-1.5 pr-16">
                Senior Frontend Engineer
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
                <span className="flex items-center">
                  <Building2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  Stripe
                </span>
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  Remote
                </span>
              </div>

              <div className="border-l-2 border-accent/40 pl-3 py-0.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Why this matches
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You know React, TypeScript and Next.js &mdash; this role leads with all three.
                </p>
              </div>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/70 text-center mt-3">
              An actual posting from today&rsquo;s feed, checked before you ever see it.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
