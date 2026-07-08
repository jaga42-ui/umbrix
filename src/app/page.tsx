"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
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
    <div className="w-full bg-primary text-primary-foreground py-2.5 min-h-[2.25rem] overflow-hidden">
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

// A radar sweep: the clearest honest metaphor for what the scam filter does
// -- continuously scanning for real signal and letting the noise pass
// through. Purely conceptual, no invented job data standing in for product.
const RADAR_BLIP_ANGLES = [20, 100, 160, 250, 320];

function VerificationRadar() {
  return (
    <div
      className="relative w-[19rem] h-[19rem] sm:w-[23rem] sm:h-[23rem] mx-auto md:mx-0"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full border border-border" />

      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 radar-sweep"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, var(--accent) 8deg, transparent 55deg)",
          }}
        />
      </div>

      {RADAR_BLIP_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <span
            key={angle}
            className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-accent opacity-60 radar-blip"
            style={{
              top: `${50 + 42 * Math.sin(rad)}%`,
              left: `${50 + 42 * Math.cos(rad)}%`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        );
      })}

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-card border-2 border-double border-accent/70 flex items-center justify-center rotate-[-8deg] shadow-[0_0_0_8px_var(--background)]">
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

// Shared easing for the entrance choreography -- a gentle overshoot-free
// deceleration (expo-out) so everything settles rather than snaps.
const EASE = [0.22, 1, 0.36, 1] as const;

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
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background flex flex-col overflow-hidden">
        <VerificationMarquee />

        <main className="flex-1 flex items-center relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 md:py-16 w-full grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-14 md:gap-6 items-center relative z-10">
            {/* Left: the pitch */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-6 flex items-center gap-2"
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-accent"
                  animate={{ opacity: [1, 0.25, 1], scale: [1, 0.7, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                />
                Daily digest &mdash; {issueDate}
              </motion.div>

              {/* Each word rises from behind its own mask -- an ink-press
                  reveal rather than a flat fade. */}
              <h1 className="font-serif text-5xl sm:text-6xl md:text-[4.5rem] leading-[1.05] tracking-tight mb-6 text-balance">
                {headlineWords.map((word, i) => (
                  <span
                    key={i}
                    className="inline-block overflow-hidden align-bottom mr-[0.28em] pb-[0.14em] -mb-[0.14em]"
                  >
                    <motion.span
                      className="inline-block"
                      initial={{ y: "120%" }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.75, delay: 0.15 + i * 0.075, ease: EASE }}
                    >
                      {word}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55, ease: EASE }}
                className="text-xl text-foreground/80 mb-2 leading-relaxed"
              >
                Stop searching everywhere. Start searching once.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.64, ease: EASE }}
                className="text-base text-muted-foreground mb-10 max-w-md leading-relaxed"
              >
                We pull roles straight from company ATS systems, run every one through
                a scam filter, and show you what&rsquo;s real. Nothing else.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.74, ease: EASE }}
                className="space-y-3"
              >
                <button
                  onClick={handleSignIn}
                  className="group relative inline-flex items-center gap-2.5 bg-primary text-primary-foreground h-12 px-6 rounded-xl font-medium active:scale-[0.97] transition-transform cursor-pointer overflow-hidden"
                >
                  {/* Light sweep across the button on hover */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-primary-foreground/25 to-transparent"
                  />
                  <motion.span
                    className="relative z-10 inline-flex items-center gap-2.5"
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

            {/* Right: the radar -- always scanning for what's real */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
              className="float-slow"
            >
              <VerificationRadar />
            </motion.div>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}
