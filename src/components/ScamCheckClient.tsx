"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  ArrowRight,
  Link2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/Header";

type Level = "scam" | "caution" | "clean";

interface Result {
  level: Level;
  score: number;
  reasons: string[];
}

// Presentation per verdict tier. Explicit semantic colors (not brand tokens) so
// the danger/safe signal reads instantly and works in light + dark themes.
const TIER = {
  scam: {
    Icon: ShieldX,
    label: "Likely a scam",
    blurb: "This has the hallmarks of a job scam. Do not pay anything or share personal documents.",
    color: "text-red-500",
    ring: "border-red-500/30",
    tint: "bg-red-500/10",
  },
  caution: {
    Icon: ShieldAlert,
    label: "Some red flags — be careful",
    blurb: "This shows a few warning signs. Verify the company independently before you proceed.",
    color: "text-amber-500",
    ring: "border-amber-500/30",
    tint: "bg-amber-500/10",
  },
  clean: {
    Icon: ShieldCheck,
    label: "No scam signals detected",
    blurb:
      "We didn't find common scam patterns — but this is not a guarantee. Always verify the company and never pay to get a job.",
    color: "text-emerald-500",
    ring: "border-emerald-500/30",
    tint: "bg-emerald-500/10",
  },
} as const;

export function ScamCheckClient() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Couldn't check this right now. Please try again.");
      }
      setResult({ level: data.level, score: data.score, reasons: data.reasons || [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setText("");
  };

  const share = async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12 md:py-16">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary border border-border mb-5">
            <ShieldCheck className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Is this job real?</h1>
          <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Paste any job post, WhatsApp message, or offer letter. We&apos;ll check it for the scam
            patterns that target freshers — pay-to-apply fees, fake deposits, and DM funnels. Free,
            no signup.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
          <label htmlFor="scam-input" className="sr-only">
            Paste a job post, message, or offer letter
          </label>
          <textarea
            id="scam-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={8000}
            rows={7}
            placeholder={
              "Paste the job post / WhatsApp message / offer letter here…\n\ne.g. \"Congrats! You're selected. Pay ₹1,500 refundable registration fee to confirm your joining.\""
            }
            className="w-full resize-y bg-background border border-border rounded-xl p-4 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/30 transition-colors"
          />
          <div className="flex items-center justify-between mt-4 gap-3">
            <span className="text-[11px] font-mono text-muted-foreground/70 tabular-nums">
              {text.length.toLocaleString()}/8,000
            </span>
            <button
              onClick={check}
              disabled={!text.trim() || loading}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {loading ? "Checking…" : "Check for scams"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/25 rounded-xl p-3.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.level}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`mt-6 bg-card border rounded-2xl overflow-hidden ${TIER[result.level].ring}`}
            >
              {/* Verdict header */}
              <div className={`flex items-start gap-4 p-5 md:p-6 ${TIER[result.level].tint}`}>
                {(() => {
                  const Icon = TIER[result.level].Icon;
                  return <Icon className={`w-8 h-8 shrink-0 ${TIER[result.level].color}`} />;
                })()}
                <div>
                  <h2 className={`text-lg font-bold ${TIER[result.level].color}`}>
                    {TIER[result.level].label}
                  </h2>
                  <p className="text-sm text-foreground/80 leading-relaxed mt-1">
                    {TIER[result.level].blurb}
                  </p>
                </div>
              </div>

              {/* Reasons */}
              {result.reasons.length > 0 && (
                <div className="px-5 md:px-6 pb-5 md:pb-6 pt-1">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    What we found
                  </span>
                  <ul className="space-y-2">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                        <AlertTriangle className="w-3.5 h-3.5 mt-1 shrink-0 text-amber-500" />
                        <span className="first-letter:uppercase">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 md:px-6 py-4">
                <button
                  onClick={reset}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Check another
                </button>
                <Link
                  href="/"
                  className="ml-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                >
                  Get real, scam-checked jobs
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share + trust footer */}
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <button
            onClick={share}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
            {copied ? "Link copied — share it" : "Share this free tool"}
          </button>
          <p className="text-[11px] text-muted-foreground/70 max-w-md leading-relaxed">
            We don&apos;t store what you paste. This is a heuristic check, not legal advice — when in
            doubt, verify the company directly and never pay money to get a job.
          </p>
        </div>
      </main>
    </div>
  );
}
