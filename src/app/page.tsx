"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

// A representative slice of real companies from the actual source list --
// illustrative here (the landing page can't call the authenticated jobs
// API), but grounded in the real product, not invented placeholders.
const MARQUEE_ITEMS = [
  { company: "Stripe", role: "Senior Frontend Engineer" },
  { company: "Airbnb", role: "Product Designer" },
  { company: "Groww", role: "Backend Engineer" },
  { company: "Datadog", role: "Site Reliability Engineer" },
  { company: "PhonePe", role: "Mobile Engineer" },
  { company: "Cloudflare", role: "Security Engineer" },
  { company: "Slice", role: "Product Manager" },
  { company: "Coinbase", role: "Data Engineer" },
  { company: "Robinhood", role: "Full-Stack Engineer" },
  { company: "Verkada", role: "Firmware Engineer" },
];

function VerificationMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="bg-primary text-primary-foreground py-2.5 overflow-hidden">
      <div className="flex marquee-track w-max">
        {items.map((item, i) => (
          <span
            key={i}
            className="font-mono text-xs uppercase tracking-wider px-6 flex items-center gap-2 shrink-0 whitespace-nowrap"
          >
            <Check className="w-3 h-3 text-accent-on-dark" />
            {item.company} &mdash; {item.role}
            <span className="ml-2 text-accent-on-dark">&bull;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function VerificationSeal() {
  return (
    <div
      className="relative w-[22rem] h-[22rem] sm:w-[26rem] sm:h-[26rem] shrink-0 pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Outer dial: a ring of tick marks, like a gauge face -- reads as an
          engineered mechanism even at rest, not just an empty circle. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full slow-spin">
        <circle cx="50" cy="50" r="47" fill="none" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1.2 5.4" strokeLinecap="round" />
      </svg>
      {/* Inner dial, denser ticks, turning the opposite way */}
      <svg viewBox="0 0 100 100" className="absolute inset-12 w-[calc(100%-6rem)] h-[calc(100%-6rem)] slow-spin-reverse">
        <circle cx="50" cy="50" r="47" fill="none" stroke="var(--foreground)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="0.8 3.2" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-card border-2 border-double border-accent/70 flex items-center justify-center rotate-[-8deg] shadow-[0_0_0_6px_var(--background)]">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent text-center leading-tight">
            Verified
            <br />
            No Scams
          </div>
        </div>
      </div>
    </div>
  );
}

const headlineWords = ["Every", "dream", "deserves", "a", "chance."];

export default function LandingPage() {
  const { user, loading, signInWithGoogle, isDemoMode } = useAuth();
  const router = useRouter();
  const [isStamping, setIsStamping] = useState(false);

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

  // signInWithGoogle must fire synchronously from the click for the OAuth
  // popup to count as a direct user gesture (browsers block window.open()
  // otherwise) -- the stamp feedback runs alongside it, never gating it.
  const handleSignIn = () => {
    setIsStamping(true);
    signInWithGoogle();
    setTimeout(() => setIsStamping(false), 900);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Loading&hellip;</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <VerificationMarquee />

      <main className="flex-1 flex items-center relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 md:py-16 w-full grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-14 md:gap-6 items-center relative z-10">
          {/* Left: the pitch */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-6 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              Daily digest &mdash; {issueDate}
            </motion.div>

            <h1 className="font-serif text-5xl sm:text-6xl md:text-[4.5rem] leading-[1.05] tracking-tight mb-6 text-balance">
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: i * 0.07,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="inline-block mr-[0.28em]"
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              className="text-xl text-foreground/80 mb-2 leading-relaxed"
            >
              Stop searching everywhere. Start searching once.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.52 }}
              className="text-base text-muted-foreground mb-10 max-w-md leading-relaxed"
            >
              We pull roles straight from company ATS systems, run every one through
              a scam filter, and show you what&rsquo;s real. Nothing else.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="space-y-3"
            >
              <button
                onClick={handleSignIn}
                className="group relative inline-flex items-center gap-2.5 bg-primary text-primary-foreground h-12 px-6 rounded-xl font-medium hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer overflow-hidden"
              >
                <motion.span
                  className="inline-flex items-center gap-2.5"
                  animate={isStamping ? { scale: [1, 0.85, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  {isStamping ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                  <span>{isDemoMode ? "Sign in as guest developer" : "Sign in with Google"}</span>
                </motion.span>
              </button>

              <p className="font-mono text-[11px] text-muted-foreground/80">
                {isDemoMode
                  ? "One click, no database or Firebase setup — try it instantly."
                  : "One click. No forms, no waiting."}
              </p>
            </motion.div>
          </div>

          {/* Right: the verification seal, large and always turning */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex justify-center md:justify-end"
          >
            <VerificationSeal />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
