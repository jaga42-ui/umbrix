"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, RefreshCw, Quote, TrendingUp, Check } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import type { ResumeAnalysis as Analysis, Finding, Severity } from "@/lib/resumeAnalyzer";
import type { SkillGapReport } from "@/lib/skillGap";

/**
 * Résumé analysis panel.
 *
 * Every animation here is doing a job, not decorating. The charter asks for a
 * calm, minimal product, so motion is reserved for things that are genuinely
 * easier to understand moving than static:
 *
 *  - the score counts up while its arc draws, so the number reads as *measured*
 *    rather than asserted;
 *  - the reach bar grows from zero, because the point being made is magnitude;
 *  - findings stagger in worst-first, so the eye lands on the critical one.
 *
 * All of it is suppressed under `prefers-reduced-motion`, which then renders the
 * final state directly — the layout never depends on an animation completing.
 */

interface AnalyzeResponse {
  success: boolean;
  analysis?: Analysis;
  skillGap?: SkillGapReport;
  error?: string;
  code?: string;
}

const SEVERITY_STYLE: Record<Severity, { rule: string; label: string; text: string }> = {
  critical: { rule: "bg-primary", label: "Fix first", text: "text-primary" },
  important: { rule: "bg-foreground/40", label: "Worth fixing", text: "text-foreground/70" },
  polish: { rule: "bg-border", label: "Polish", text: "text-muted-foreground" },
};

const BAND_COPY: Record<Analysis["band"], string> = {
  strong: "Strong. A recruiter can assess you quickly.",
  "getting-there": "Getting there. A few changes will move this a long way.",
  "needs-work": "Needs work — and every issue below is fixable today.",
};

/**
 * Count a number up over `ms`. Returns the target immediately if motion is off.
 *
 * The disabled case is derived on return rather than written into state from an
 * effect — a reduced-motion user should get the final number on first paint,
 * not a zero that a later render corrects.
 */
function useCountUp(target: number, ms: number, enabled: boolean): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Ease-out: fast at first, settling at the end — reads as "resolving".
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, ms, enabled]);

  return enabled ? value : target;
}

function ScoreDial({ score, band, animate }: { score: number; band: Analysis["band"]; animate: boolean }) {
  const shown = useCountUp(score, 900, animate);
  const R = 52;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" strokeWidth="6" className="stroke-border" />
          <motion.circle
            cx="64" cy="64" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
            className="stroke-primary"
            initial={{ strokeDasharray: CIRC, strokeDashoffset: animate ? CIRC : CIRC * (1 - score / 100) }}
            animate={{ strokeDashoffset: CIRC * (1 - score / 100) }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Tabular numerals stop the width jittering while it counts. */}
          <span className="text-3xl font-semibold tabular-nums text-foreground">{shown}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">of 100</span>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-foreground">Résumé score</h3>
        <p className="text-sm text-muted-foreground mt-1">{BAND_COPY[band]}</p>
      </div>
    </div>
  );
}

/**
 * Market reach.
 *
 * The distinctive part of this panel. A single track shows how much of the
 * eligible market the candidate's current skills already reach, and each
 * suggested skill renders a ghost extension showing how much further that one
 * addition would take them. Hovering a skill lights its segment, so "learn SQL"
 * stops being advice and becomes a visible distance on a bar.
 *
 * Every figure is a count of real open listings — see @/lib/skillGap.
 */
function MarketReach({ gap, animate }: { gap: SkillGapReport; animate: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (gap.sampleSize === 0) return null;

  const pct = (n: number) => Math.min(100, (n / gap.sampleSize) * 100);
  const hoveredSkill = gap.opportunities.find((o) => o.skill === hovered);
  const ghostWidth = hoveredSkill ? pct(hoveredSkill.jobsUnlocked) : 0;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" aria-hidden />
          Market reach
        </h4>
        {/* Composed as one string: adjacent JSX expressions drop the literal
            space between them, which rendered "100roles". */}
        <p className="text-xs text-muted-foreground">
          {`${gap.reachable} of ${gap.sampleSize} roles you're eligible for`}
        </p>
      </div>

      <div className="mt-3 h-3 w-full bg-secondary/60 border border-border/60 overflow-hidden flex">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: animate ? 0 : `${gap.coverage}%` }}
          animate={{ width: `${gap.coverage}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        {/* The extension a hovered skill would add — deliberately hatched, so it
            never reads as reach the candidate already has. */}
        <motion.div
          className="h-full bg-primary/25"
          initial={false}
          animate={{ width: `${ghostWidth}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Your skills reach <span className="font-semibold text-foreground">{gap.coverage}%</span> of them.
        {hoveredSkill && (
          <span className="text-primary">
            {" "}
            Adding {hoveredSkill.skill} would open {hoveredSkill.jobsUnlocked} more.
          </span>
        )}
      </p>

      {gap.opportunities.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {gap.opportunities.map((o, i) => (
            <motion.li
              key={o.skill}
              initial={animate ? { opacity: 0, x: -6 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
              onMouseEnter={() => setHovered(o.skill)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(o.skill)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              className="group flex items-center gap-3 px-2 py-1.5 -mx-2 cursor-default outline-none focus-visible:bg-secondary/60 hover:bg-secondary/60 transition-colors"
            >
              <span className="text-sm font-medium text-foreground capitalize w-28 shrink-0 truncate">
                {o.skill}
              </span>
              <span className="flex-1 h-1.5 bg-secondary/70 overflow-hidden">
                <motion.span
                  className="block h-full bg-primary/60 group-hover:bg-primary transition-colors"
                  initial={animate ? { width: 0 } : false}
                  animate={{ width: `${pct(o.jobsUnlocked)}%` }}
                  transition={{ delay: 0.35 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                />
              </span>
              <span className="text-xs tabular-nums text-muted-foreground w-24 text-right shrink-0">
                +{o.jobsUnlocked} roles
              </span>
            </motion.li>
          ))}
        </ul>
      )}

      {gap.validatedSkills.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          In demand from your list:{" "}
          {gap.validatedSkills.map((s) => (
            <span key={s.skill} className="capitalize text-foreground/80">
              {s.skill} ({s.demand}){" "}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function FindingCard({ finding, index, animate }: { finding: Finding; index: number; animate: boolean }) {
  const style = SEVERITY_STYLE[finding.severity];
  return (
    <motion.li
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative pl-4 py-3"
    >
      {/* Severity as a rule rather than a coloured badge — quieter, and it still
          scans instantly down the left edge. */}
      <span className={`absolute left-0 top-3 bottom-3 w-[2px] ${style.rule}`} aria-hidden />
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-[10px] uppercase tracking-widest ${style.text}`}>{style.label}</span>
        <h5 className="text-sm font-semibold text-foreground">{finding.title}</h5>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>
      <p className="mt-1.5 text-sm text-foreground/90">
        <span className="font-medium">Do this: </span>
        {finding.fix}
      </p>
      {finding.evidence && finding.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {finding.evidence.map((line, i) => (
            <li
              key={i}
              className="flex gap-1.5 text-xs text-muted-foreground bg-secondary/50 border-l-2 border-border px-2 py-1 font-mono"
            >
              <Quote className="w-3 h-3 shrink-0 mt-0.5 opacity-50" aria-hidden />
              <span className="break-words">{line}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}

/**
 * The report itself — pure presentation, no data fetching.
 *
 * Split out so the visual design can be rendered from fixed data without an
 * authenticated session and a live database behind it. The panel below owns
 * fetching and states; this owns only how a finished analysis looks.
 */
export function AnalysisReport({
  analysis,
  gap,
  animate,
}: {
  analysis: Analysis;
  gap: SkillGapReport | null;
  animate: boolean;
}) {
  return (
    <>
      <ScoreDial score={analysis.score} band={analysis.band} animate={animate} />

      {analysis.strengths.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {analysis.strengths.map((s) => (
            <li key={s} className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Check className="w-3 h-3 text-primary" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      )}

      {gap && <MarketReach gap={gap} animate={animate} />}

      {analysis.findings.length > 0 ? (
        <section className="mt-8">
          <h4 className="text-sm font-semibold text-foreground">
            {analysis.findings.length} thing{analysis.findings.length === 1 ? "" : "s"} to fix
          </h4>
          <ul className="mt-1 divide-y divide-border/60">
            {analysis.findings.map((f, i) => (
              <FindingCard key={f.id} finding={f} index={i} animate={animate} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing to flag — this résumé clears every check we run.
        </p>
      )}
    </>
  );
}

export function ResumeAnalysis({ hasResume }: { hasResume: boolean }) {
  const reduced = useReducedMotion();
  const animate = !reduced;

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [gap, setGap] = useState<SkillGapReport | null>(null);
  const [error, setError] = useState<string>("");

  async function run() {
    setState("loading");
    setError("");
    try {
      const res = await authedFetch("/api/resume/analyze", { method: "POST" });
      const data: AnalyzeResponse = await res.json();
      if (!data.success || !data.analysis) {
        setError(data.error || "Could not analyse your résumé.");
        setState("error");
        return;
      }
      setAnalysis(data.analysis);
      setGap(data.skillGap ?? null);
      setState("done");
    } catch {
      setError("Network problem — check your connection and try again.");
      setState("error");
    }
  }

  // Empty state: never a blank panel, always an invitation to act.
  if (!hasResume) {
    return (
      <div className="border border-border/60 bg-background p-5">
        <h3 className="text-sm font-semibold text-foreground">Résumé analysis</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your résumé above and we&apos;ll score it, show exactly what to fix, and tell you which
          skills would open the most roles.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border/60 bg-background p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden />
            Résumé analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scored against real openings you qualify for.
          </p>
        </div>
        <button
          onClick={run}
          disabled={state === "loading"}
          className="text-sm font-medium px-3 py-1.5 border border-border hover:bg-secondary/70 disabled:opacity-60 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state === "loading" ? "animate-spin" : ""}`} aria-hidden />
          {state === "done" ? "Re-analyse" : state === "loading" ? "Analysing…" : "Analyse my résumé"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-5 space-y-2"
            role="status" aria-live="polite"
          >
            <span className="sr-only">Analysing your résumé</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 bg-secondary/70 animate-pulse" style={{ width: `${90 - i * 22}%` }} />
            ))}
          </motion.div>
        )}

        {state === "error" && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-4 text-sm text-foreground flex items-start gap-2"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
            {error}
          </motion.p>
        )}

        {state === "done" && analysis && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <AnalysisReport analysis={analysis} gap={gap} animate={animate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
