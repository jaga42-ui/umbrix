"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, Sparkles, Loader2, Download, FileText, AlertTriangle, Check } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";

interface StructuredResume {
  contact: { name: string; email?: string; phone?: string; location?: string; links?: string[] };
  summary: string;
  skills: string[];
  experience: { role: string; company: string; start?: string; end?: string; bullets: string[] }[];
  education: { degree: string; institution: string; year?: string }[];
}

interface Props {
  /** Linked feed job (full description). Omit for manual cards → tailor from title+company. */
  jobId?: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
}

type Phase = "idle" | "generating" | "done" | "error";

export function TailorResumeModal({ jobId, jobTitle, company, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [resume, setResume] = useState<StructuredResume | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const generate = async () => {
    setPhase("generating");
    setError(null);
    try {
      const res = await authedFetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Linked job → send jobId (full JD); manual card → send raw title+company.
        body: JSON.stringify(jobId ? { jobId } : { title: jobTitle, company }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError({ msg: data.error || "Couldn't tailor your résumé.", code: data.code });
        setPhase("error");
        return;
      }
      setResume(data.resume);
      setResumeId(data.id);
      setRemaining(data.remaining);
      setPhase("done");
    } catch {
      setError({ msg: "Something went wrong. Please try again." });
      setPhase("error");
    }
  };

  const download = async () => {
    if (!resumeId) return;
    setDownloading(true);
    try {
      const res = await authedFetch(`/api/resume/tailor/${resumeId}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${company}_${jobTitle}.docx`.replace(/[^A-Za-z0-9_.]+/g, "_");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError({ msg: "Download failed. Please try again." });
      setPhase("error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-card border border-border p-6 rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI Résumé Tailoring
          </span>
        </div>
        <h3 className="text-lg font-bold tracking-tight mb-1">{jobTitle}</h3>
        <p className="text-sm text-muted-foreground mb-5">{company}</p>

        {/* IDLE */}
        {phase === "idle" && (
          <>
            <p className="text-sm text-foreground/85 leading-relaxed mb-5">
              We&apos;ll rewrite your résumé to target this role — reordering skills, sharpening
              bullets, and weaving in the job&apos;s keywords. <strong>Truthful</strong> (we never
              invent experience) and <strong>ATS-friendly</strong>, ready to download as a .docx.
            </p>
            <button
              onClick={generate}
              className="um-btn um-btn--primary w-full h-11 rounded-none text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Generate tailored résumé
            </button>
          </>
        )}

        {/* GENERATING */}
        {phase === "generating" && (
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Tailoring your résumé for {company}…
              <br />
              <span className="text-xs">This takes a few seconds.</span>
            </p>
          </div>
        )}

        {/* ERROR */}
        {phase === "error" && error && (
          <div className="py-4">
            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/25 rounded-none p-3.5 mb-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error.msg}</span>
            </div>
            {error.code === "NO_RESUME" ? (
              <Link
                href="/profile"
                className="um-btn um-btn--primary w-full h-11 rounded-none text-sm font-semibold flex items-center justify-center gap-2"
                style={{ textDecoration: "none" }}
              >
                Upload your résumé
              </Link>
            ) : error.code === "QUOTA_REACHED" ? (
              <p className="text-xs text-muted-foreground text-center">
                You&apos;ve used your free tailors this month. Unlimited tailoring is coming with premium.
              </p>
            ) : (
              <button
                onClick={generate}
                className="um-btn um-btn--secondary w-full h-11 rounded-none text-sm font-semibold cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* DONE — preview + download */}
        {phase === "done" && resume && (
          <div>
            <div className="border border-border rounded-none p-4 bg-secondary/20 mb-4 max-h-[42vh] overflow-y-auto">
              <div className="font-semibold text-foreground">{resume.contact.name}</div>
              {resume.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">{resume.summary}</p>
              )}
              {resume.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {resume.skills.slice(0, 14).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-[10px] font-medium bg-background border border-border/60 rounded-none text-foreground/80"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {resume.experience.slice(0, 3).map((e, i) => (
                <div key={i} className="mt-3">
                  <div className="text-xs font-semibold text-foreground">
                    {e.role}
                    {e.company ? ` — ${e.company}` : ""}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {e.bullets.slice(0, 3).map((b, j) => (
                      <li key={j} className="text-[11px] text-muted-foreground leading-snug pl-3 relative">
                        <span className="absolute left-0">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              onClick={download}
              disabled={downloading}
              className="um-btn um-btn--primary w-full h-11 rounded-none text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download .docx
            </button>

            <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" /> ATS-friendly Word format
              </span>
              {remaining !== null && (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-stage-interview" />
                  {remaining} left this month
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed">
              Review before you send — we tailor phrasing and emphasis, not facts.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
