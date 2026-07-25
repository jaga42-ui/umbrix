"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Bookmark, BookmarkCheck, ExternalLink, Loader2, X, GraduationCap, Sparkles, TrendingUp } from "lucide-react";
import { TailorResumeModal } from "@/components/TailorResumeModal";
import { track } from "@/lib/analytics";
import { topMissingSkill } from "@/lib/matchScore";
import { courseForSkill } from "@/lib/skillCourses";

// A company monogram stands in for a logo — we don't have logo assets for
// aggregator listings, and a consistent lettered avatar reads far more
// legit than a bare company name. Tints stay inside the app's earthy palette
// and are picked deterministically so a company always looks the same.
const MONOGRAM_TINTS = [
  "bg-[#e7e0d0] text-[#6b5d3e]",
  "bg-[#dde6dc] text-[#465a43]",
  "bg-[#e6dde4] text-[#5d4658]",
  "bg-[#dfe3ea] text-[#43506a]",
  "bg-[#ecdfd6] text-[#7a5640]",
  "bg-[#dae5e4] text-[#3d5f5c]",
];
function monogramTint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MONOGRAM_TINTS[h % MONOGRAM_TINTS.length];
}
function companyInitial(name: string): string {
  return ((name || "?").trim()[0] || "?").toUpperCase();
}
/** "Posted today / 3d ago / 2mo ago" from a timestamp — freshness is a trust cue. */
function postedAgo(when?: string | Date | null): string | null {
  if (!when) return null;
  const t = new Date(when).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days}d ago`;
  return `Posted ${Math.floor(days / 30)}mo ago`;
}
/** Pay line — stipend (monthly INR) or a salary range string, when present. */
function formatPay(salary?: string, stipend?: number | null): string | null {
  if (typeof stipend === "number" && stipend > 0) return `₹${stipend.toLocaleString("en-IN")}/mo`;
  if (salary && salary.trim()) return salary.trim();
  return null;
}
/** Explicit experience requirement, Naukri-style. */
function expLabel(minExperience?: number | null): string | null {
  if (minExperience == null) return null;
  if (minExperience <= 0) return "0 yrs exp";
  if (minExperience === 1) return "0–1 yrs exp";
  return `${minExperience}+ yrs exp`;
}
const TYPE_LABEL: Record<string, string> = {
  job: "Full-time",
  internship: "Internship",
  scholarship: "Scholarship",
};

interface JobCardProps {
  id: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  matchSummary: string;
  matchScore: number;
  matchingSkills?: string[];
  missingSkills?: string[];
  matchExplanation?: string[];
  applyUrl: string;
  minExperience?: number | null;
  /** Aggregator source (e.g. "Adzuna") when the apply link goes via a redirect; omit for direct ATS links. */
  source?: string;
  /** Freshness — when the posting was first seen. */
  createdAt?: string | Date;
  /** Monthly stipend in INR (internships). */
  stipend?: number | null;
  /** Salary range string (jobs). */
  salary?: string;
  /** "job" | "internship" | "scholarship" — drives the type chip. */
  type?: string;
  isSaved?: boolean;
  onSave?: () => Promise<void>;
}

export function JobCard({
  id,
  title,
  company,
  location,
  tags,
  matchSummary,
  matchScore,
  matchingSkills = [],
  missingSkills = [],
  matchExplanation = [],
  applyUrl,
  minExperience,
  source,
  createdAt,
  stipend,
  salary,
  type,
  isSaved = false,
  onSave,
}: JobCardProps) {
  const fresherEligible = minExperience != null && minExperience <= 1;
  const pay = formatPay(salary, stipend);
  const posted = postedAgo(createdAt);
  const facts = [expLabel(minExperience), type ? TYPE_LABEL[type] ?? null : null].filter(Boolean) as string[];
  // The single closest recognized skill to add — shown only when they already
  // match something, so it reads as "you're close, add this" not "you don't qualify".
  const gapSkill = matchingSkills.length > 0 ? topMissingSkill(missingSkills) : null;
  const gapCourse = gapSkill ? courseForSkill(gapSkill) : null;
  const [saving, setSaving] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showTailorModal, setShowTailorModal] = useState(false);

  const handleSave = async () => {
    if (isSaved || !onSave) return;
    setSaving(true);
    try {
      await onSave();
      track("save_job", { jobId: id, score: matchScore });
    } catch (e) {
      console.error("Failed to save opportunity:", e);
    } finally {
      setSaving(false);
    }
  };

  // Color grade based on match score, using the same ink palette as the
  // rest of the app rather than generic Tailwind hues.
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "text-stage-interview";
    if (score >= 80) return "text-stage-applied";
    return "text-muted-foreground";
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="group relative bg-card text-card-foreground border border-border p-6 rounded-2xl hover:border-foreground/25 transition-colors duration-300 overflow-hidden flex flex-col md:flex-row gap-6 items-start w-full"
      >
        {/* Match Score Badge, with the verified stamp docked to its own corner
            -- kept inside this column's own relative box so it can never
            collide with the Save/Apply buttons in the content area. */}
        <button
          onClick={() => setShowMatchModal(true)}
          className="relative flex flex-row md:flex-col items-center justify-center shrink-0 w-full md:w-20 py-3 md:py-4 px-4 bg-secondary/50 hover:bg-secondary rounded-xl border border-border text-center gap-2 cursor-pointer transition-colors active:scale-95 group/badge"
          title="Click to view detailed match report"
        >
          {/* Verified stamp -- every posting here passed the scam filter, so
              this marks a real, checked fact, not decoration. */}
          <div
            className="stamp-mark pointer-events-none absolute -top-3 -right-3 w-12 h-12 rounded-full border-2 border-double border-accent/70 bg-card flex items-center justify-center rotate-[-8deg] z-10"
            aria-hidden="true"
          >
            <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.06em] text-accent text-center leading-[1.15]">
              Verified
              <br />
              No Scams
            </span>
          </div>

          <div className={`font-mono text-2xl font-semibold tracking-tight ${getScoreColorClass(matchScore)}`}>
            {matchScore}%
          </div>
          <div className="text-[10px] font-mono uppercase font-semibold tracking-wider text-muted-foreground leading-none group-hover/badge:text-foreground transition-colors">
            Match
          </div>
        </button>

        {/* Main Content Area */}
        <div className="flex-1 space-y-4 w-full">
          <div className="flex justify-between items-start flex-col sm:flex-row gap-4">
            <div className="flex gap-3.5 min-w-0">
              {/* Company monogram — a logo stand-in that anchors the card. */}
              <div
                className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-serif font-bold text-lg select-none ${monogramTint(company)}`}
                aria-hidden="true"
              >
                {companyInitial(company)}
              </div>

              <div className="min-w-0">
                <h3 className="text-xl font-bold tracking-tight mb-1 group-hover:text-primary transition-colors">
                  {title}
                </h3>

                {/* Company · location · trust badges */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/90">{company}</span>
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 shrink-0 text-muted-foreground/70" />
                    {location}
                  </span>
                  {fresherEligible && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded-full"
                      title="Open to freshers — little or no experience required"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Fresher-friendly
                    </span>
                  )}
                  {source && (
                    <span
                      className="text-[11px] text-muted-foreground/70"
                      title={`Listing aggregated from ${source} — Apply opens ${source} first, then the employer's page`}
                    >
                      via {source}
                    </span>
                  )}
                </div>

                {/* Naukri-style facts: pay · experience · type · freshness. Each
                    only shows when we actually have it — never a blank field. */}
                {(pay || facts.length > 0 || posted) && (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-xs">
                    {pay && (
                      <span className="font-semibold text-foreground bg-secondary/70 border border-border/60 px-2 py-0.5 rounded-md">
                        {pay}
                      </span>
                    )}
                    {facts.length > 0 && <span className="text-muted-foreground">{facts.join(" · ")}</span>}
                    {posted && <span className="text-muted-foreground/70">{posted}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto shrink-0">
              {/* Tailor résumé (AI) */}
              <button
                onClick={() => setShowTailorModal(true)}
                title="Generate an ATS-friendly résumé tailored to this role"
                className="flex-1 sm:flex-initial h-10 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border bg-background text-foreground border-border hover:bg-secondary hover:border-foreground/20 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                Tailor résumé
              </button>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaved || saving}
                className={`flex-1 sm:flex-initial h-10 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isSaved
                    ? "bg-secondary text-muted-foreground border-border/80 cursor-default"
                    : "bg-background text-foreground border-border hover:bg-secondary hover:border-foreground/20 active:scale-95"
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-stage-interview" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                {isSaved ? "Saved" : saving ? "Saving..." : "Save"}
              </button>

              {/* Apply Button */}
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("apply_click", { jobId: id, score: matchScore, ...(source ? { source } : {}) })}
                className="flex-1 sm:flex-initial h-10 px-4 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
              >
                <span>Apply</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs font-medium bg-secondary/80 text-secondary-foreground rounded-lg border border-border/30 hover:border-border transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Match summary, styled like a marginal note rather than a feature callout */}
          <div className="border-l-2 border-accent/40 pl-3.5 py-0.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Why this matches
            </span>
            <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">{matchSummary}</p>
            {gapSkill && (
              <p className="mt-1.5 text-xs flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5 text-accent shrink-0" />
                {gapCourse ? (
                  <span>
                    One to add:{" "}
                    <a
                      href={gapCourse.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        track("gap_nudge_click", { jobId: id, skill: gapSkill, hasCourse: true });
                        track("gap_course_view", { skill: gapSkill, provider: gapCourse.provider });
                      }}
                      className="font-semibold text-accent underline underline-offset-2 hover:opacity-80"
                    >
                      learn {gapSkill}
                    </a>{" "}
                    to be an even stronger fit.
                  </span>
                ) : (
                  <span>
                    One to add:{" "}
                    <button
                      onClick={() => {
                        track("gap_nudge_click", { jobId: id, skill: gapSkill, hasCourse: false });
                        setShowMatchModal(true);
                      }}
                      className="font-semibold text-foreground underline underline-offset-2 hover:opacity-80 cursor-pointer"
                    >
                      {gapSkill}
                    </button>{" "}
                    would make you an even stronger fit.
                  </span>
                )}
              </p>
            )}
            <button
              onClick={() => setShowMatchModal(true)}
              className="text-xs text-foreground/80 hover:text-foreground font-medium mt-1.5 flex items-center gap-0.5 cursor-pointer"
            >
              View full report &rarr;
            </button>
          </div>
        </div>
      </motion.div>

      {/* Match Details Modal Overlay */}
      <AnimatePresence>
        {showMatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-card border border-border p-6 rounded-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Close button */}
              <button
                onClick={() => setShowMatchModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Match report
              </span>

              {/* Job Info */}
              <div className="mb-4">
                <h4 className="font-serif font-semibold text-lg text-foreground">{title}</h4>
                <div className="text-sm text-foreground/80 font-medium">{company} &bull; <span className="text-muted-foreground font-normal text-xs">{location}</span></div>
              </div>

              {/* Match Score Indicator */}
              <div className="flex items-center gap-4 bg-secondary/50 p-4 rounded-xl border border-border mb-6">
                <div className={`font-mono text-3xl font-semibold ${getScoreColorClass(matchScore)}`}>
                  {matchScore}%
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Compatibility score</div>
                  <div className="text-xs text-foreground mt-0.5">Based on your uploaded skills profile.</div>
                </div>
              </div>

              {/* Skills Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Matching Skills */}
                <div className="space-y-2">
                  <span className="text-xs font-mono font-semibold text-stage-interview uppercase tracking-wider block">Matching ({matchingSkills.length})</span>
                  <div className="flex flex-wrap gap-1.5 min-h-[40px] border border-border p-2.5 rounded-xl bg-secondary/20">
                    {matchingSkills.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/80 italic">No matching skills found.</span>
                    ) : (
                      matchingSkills.map(s => (
                        <span key={s} className="bg-background text-stage-interview border border-stage-interview/25 text-[10px] font-medium px-2 py-0.5 rounded-md">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="space-y-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider block">Missing ({missingSkills.length})</span>
                  <div className="flex flex-wrap gap-1.5 min-h-[40px] border border-border p-2.5 rounded-xl bg-secondary/20">
                    {missingSkills.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/85 italic">No missing skills!</span>
                    ) : (
                      missingSkills.map(s => {
                        const course = courseForSkill(s);
                        return course ? (
                          <a
                            key={s}
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              track("gap_nudge_click", { jobId: id, skill: s, hasCourse: true, source: "modal" });
                              track("gap_course_view", { skill: s, provider: course.provider, source: "modal" });
                            }}
                            className="bg-secondary text-accent border border-accent/30 text-[10px] font-semibold px-2 py-0.5 rounded-md hover:opacity-80 underline underline-offset-2"
                          >
                            {s}
                          </a>
                        ) : (
                          <span key={s} className="bg-secondary text-muted-foreground border border-border/50 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {s}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Analysis Explanation Bullet Points */}
              <div className="space-y-3">
                <span className="text-xs font-mono font-semibold text-foreground uppercase tracking-wider block">Detailed analysis</span>
                <ul className="space-y-2.5">
                  {matchExplanation.length === 0 ? (
                    <li className="text-xs text-muted-foreground leading-relaxed pl-3 border-l border-border">
                      {matchSummary}
                    </li>
                  ) : (
                    matchExplanation.map((point, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground leading-relaxed pl-3 border-l border-border">
                        {point}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI résumé tailoring */}
      {showTailorModal && (
        <TailorResumeModal
          jobId={id}
          jobTitle={title}
          company={company}
          onClose={() => setShowTailorModal(false)}
        />
      )}
    </>
  );
}
