"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, MapPin, Sparkles, Bookmark, BookmarkCheck, ExternalLink, Loader2, X } from "lucide-react";

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
  isSaved = false,
  onSave,
}: JobCardProps) {
  const [saving, setSaving] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const handleSave = async () => {
    if (isSaved || !onSave) return;
    setSaving(true);
    try {
      await onSave();
    } catch (e) {
      console.error("Failed to save opportunity:", e);
    } finally {
      setSaving(false);
    }
  };

  // Color grade based on match score
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 80) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="group relative bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden flex flex-col md:flex-row gap-6 items-start w-full"
      >
        {/* Subtle top gradient on hover */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Match Score Badge (Left Side or Top on mobile) */}
        <button
          onClick={() => setShowMatchModal(true)}
          className="flex flex-row md:flex-col items-center justify-center shrink-0 w-full md:w-20 py-3 md:py-4 px-4 bg-secondary/30 hover:bg-secondary/60 rounded-xl border border-border/50 text-center gap-2 cursor-pointer transition-colors active:scale-95 group/badge"
          title="Click to view detailed AI Match report"
        >
          <div className={`text-2xl font-bold tracking-tight px-3 py-1.5 md:p-0 md:bg-transparent rounded-lg ${getScoreColorClass(matchScore).split(" ")[0]}`}>
            {matchScore}%
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground leading-none group-hover/badge:text-primary transition-colors">
            Match
          </div>
        </button>

        {/* Main Content Area */}
        <div className="flex-1 space-y-4 w-full">
          <div className="flex justify-between items-start flex-col sm:flex-row gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight mb-1.5 group-hover:text-primary transition-colors">
                {title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center">
                  <Building2 className="w-4 h-4 mr-1.5 shrink-0 text-muted-foreground/80" />
                  {company}
                </span>
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1.5 shrink-0 text-muted-foreground/80" />
                  {location}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
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
                  <BookmarkCheck className="w-4 h-4 text-emerald-500" />
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

          {/* AI Match Summary explanation box */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
              <Sparkles className="w-24 h-24" />
            </div>
            <div className="flex items-start space-x-2.5 relative z-10">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold text-primary block mb-1">AI Match Insight</span>
                <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">{matchSummary}</p>
                <button 
                  onClick={() => setShowMatchModal(true)}
                  className="text-xs text-primary/80 hover:text-primary font-semibold mt-1.5 flex items-center gap-0.5 cursor-pointer"
                >
                  View full match report &rarr;
                </button>
              </div>
            </div>
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
              className="relative w-full max-w-lg bg-card/90 border border-border p-6 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto backdrop-blur-xl"
            >
              {/* Close button */}
              <button
                onClick={() => setShowMatchModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">AI Match Insights</h3>
              </div>

              {/* Job Info */}
              <div className="mb-4">
                <h4 className="font-bold text-base text-foreground">{title}</h4>
                <div className="text-sm text-primary font-semibold">{company} &bull; <span className="text-muted-foreground font-normal text-xs">{location}</span></div>
              </div>

              {/* Match Score Indicator */}
              <div className="flex items-center gap-4 bg-secondary/35 p-4 rounded-xl border border-border/40 mb-6">
                <div className={`text-3xl font-extrabold px-3 py-2 rounded-xl ${getScoreColorClass(matchScore)}`}>
                  {matchScore}%
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compatibility Score</div>
                  <div className="text-xs text-foreground mt-0.5">Based on your uploaded skills profile.</div>
                </div>
              </div>

              {/* Skills Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Matching Skills */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Matching Skills ({matchingSkills.length})</span>
                  <div className="flex flex-wrap gap-1.5 min-h-[40px] border border-emerald-500/10 p-2.5 rounded-xl bg-emerald-500/5">
                    {matchingSkills.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/80 italic">No matching skills found.</span>
                    ) : (
                      matchingSkills.map(s => (
                        <span key={s} className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Missing Skills ({missingSkills.length})</span>
                  <div className="flex flex-wrap gap-1.5 min-h-[40px] border border-border p-2.5 rounded-xl bg-secondary/20">
                    {missingSkills.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/85 italic">No missing skills!</span>
                    ) : (
                      missingSkills.map(s => (
                        <span key={s} className="bg-secondary text-muted-foreground border border-border/50 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Analysis Explanation Bullet Points */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">Detailed Match Analysis</span>
                <ul className="space-y-2.5">
                  {matchExplanation.length === 0 ? (
                    <li className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{matchSummary}</span>
                    </li>
                  ) : (
                    matchExplanation.map((point, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
