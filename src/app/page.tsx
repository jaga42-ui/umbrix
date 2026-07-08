"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// A representative slice of real companies from the actual source list --
// illustrative here (the landing page can't call the authenticated jobs
// API), but grounded in the real product, not invented placeholders.
const LIVE_SAMPLE = [
  { company: "Stripe", role: "Senior Frontend Engineer" },
  { company: "Airbnb", role: "Product Designer" },
  { company: "Groww", role: "Backend Engineer" },
  { company: "Datadog", role: "Site Reliability Engineer" },
  { company: "PhonePe", role: "Mobile Engineer" },
  { company: "Cloudflare", role: "Security Engineer" },
  { company: "Slice", role: "Product Manager" },
];

function VerificationTicker() {
  const [index, setIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Reduced motion: hold on the first item instead of auto-cycling.
    if (shouldReduceMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % LIVE_SAMPLE.length);
    }, 2600);
    return () => clearInterval(id);
  }, [shouldReduceMotion]);

  const current = LIVE_SAMPLE[index];

  return (
    <div className="bg-card border border-border rounded-2xl p-8 max-w-sm mx-auto md:mx-0">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-7 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
        Scanning today&rsquo;s postings
      </div>

      <div className="min-h-[7.5rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight mb-1 truncate">
                {current.company}
              </div>
              <div className="text-sm text-muted-foreground truncate">{current.role}</div>
            </div>

            <div
              key={`stamp-${index}`}
              className={`shrink-0 w-11 h-11 rounded-full border-2 border-double border-accent/70 flex items-center justify-center rotate-[-8deg] ${
                shouldReduceMotion ? "" : "stamp-mark"
              }`}
              aria-hidden="true"
            >
              <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.06em] text-accent text-center leading-[1.15]">
                Verified
                <br />
                No Scams
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-7 pt-5 border-t border-border flex items-center gap-1.5" aria-hidden="true">
        {LIVE_SAMPLE.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-accent" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

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

          {/* Right: the verification mechanic itself, in motion */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          >
            <VerificationTicker />
            <p className="font-mono text-[11px] text-muted-foreground/70 text-center mt-3">
              Every posting is checked like this before it ever reaches you.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
