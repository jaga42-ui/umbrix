"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

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
            <Check className="w-3 h-3 text-[var(--landing-ink-on-dark)]" />
            {item.company} &mdash; {item.role}
            <span className="ml-2 text-[var(--landing-ink-on-dark)]">&bull;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// A radar sweep: the clearest honest metaphor for what the scam filter does
// -- continuously scanning for real signal and letting the noise pass
// through. The sources radiating outward are real companies from the actual
// 61-company list (61 - 6 shown = "+55 more" is the literal, accurate count) --
// deliberately real employers, not job boards, since going direct to company
// ATS instead of scraping boards like Naukri/LinkedIn is the actual product.
const RADAR_SOURCES = [
  { name: "Stripe", angle: 235 },
  { name: "Cloudflare", angle: 305 },
  { name: "Groww", angle: 180 },
  { name: "Airbnb", angle: 0 },
  { name: "PhonePe", angle: 145 },
  { name: "Datadog", angle: 35 },
];

const RING_RADII = [22, 33, 44];

// Shared easing for the entrance choreography -- a gentle overshoot-free
// deceleration (expo-out) so everything settles rather than snaps.
const EASE = [0.22, 1, 0.36, 1] as const;

function polar(angleDeg: number, radiusPct: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    top: `${50 + radiusPct * Math.sin(rad)}%`,
    left: `${50 + radiusPct * Math.cos(rad)}%`,
  };
}

function VerificationRadar() {
  return (
    <div className="relative w-full max-w-[26rem] sm:max-w-[30rem] aspect-square mx-auto md:mx-0" aria-hidden="true">
      {/* Concentric dial rings, clipped together with the sweep */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        {RING_RADII.map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-dashed border-border"
            style={{
              top: `${50 - r}%`,
              left: `${50 - r}%`,
              width: `${r * 2}%`,
              height: `${r * 2}%`,
            }}
          />
        ))}
        <div
          className="absolute inset-0 radar-sweep"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, var(--landing-ink) 8deg, transparent 55deg)",
          }}
        />
      </div>

      {/* Connecting lines: each source flows into the verified core --
          drawn in (not just faded) after the badges settle. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
        {RADAR_SOURCES.map((source, i) => {
          const rad = (source.angle * Math.PI) / 180;
          const x1 = 50 + 24 * Math.cos(rad);
          const y1 = 50 + 24 * Math.sin(rad);
          const x2 = 50 + 47 * Math.cos(rad);
          const y2 = 50 + 47 * Math.sin(rad);
          return (
            <motion.line
              key={source.name}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--landing-ink)"
              strokeOpacity="0.35"
              strokeWidth="0.6"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 1 + i * 0.08, ease: EASE }}
            />
          );
        })}
      </svg>

      {/* Spoke tips on the mid ring, one per source, marking where each
          "signal" sits before it radiates out to its badge. */}
      {RADAR_SOURCES.map((source, i) => (
        <span
          key={source.name}
          className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full opacity-70 radar-blip"
          style={{ ...polar(source.angle, 33), backgroundColor: "var(--landing-ink)", animationDelay: `${i * 0.5}s` }}
        />
      ))}

      {/* Source badges, radiating outward from the scan */}
      {RADAR_SOURCES.map((source, i) => (
        <motion.div
          key={source.name}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: EASE }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-card border border-border rounded-full pl-1.5 pr-3.5 py-1.5 whitespace-nowrap"
          style={polar(source.angle, 52)}
        >
          <span className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center font-mono text-[10px] font-semibold text-foreground shrink-0">
            {source.name.charAt(0)}
          </span>
          <span className="text-xs font-medium">{source.name}</span>
        </motion.div>
      ))}

      {/* The literal, accurate count of everything else in the source list */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 + RADAR_SOURCES.length * 0.08, ease: EASE }}
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground border border-dashed border-border rounded-full px-3.5 py-1.5 whitespace-nowrap"
        style={polar(90, 52)}
      >
        +55 more
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-24 h-24 rounded-full bg-card border-2 border-double flex flex-col items-center justify-center gap-1 shadow-[0_0_0_8px_var(--background)]"
          style={{ borderColor: "color-mix(in srgb, var(--landing-ink) 70%, transparent)" }}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: "var(--landing-ink)" }} />
          <div
            className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-center leading-tight"
            style={{ color: "var(--landing-ink)" }}
          >
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
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--landing-ink)" }}
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
                      initial={{ y: "120%", filter: "blur(6px)" }}
                      animate={{ y: 0, filter: "blur(0px)" }}
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
