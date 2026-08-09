"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { toCareerProfile, type StoredProfile } from "@/lib/career/adapt";
import { buildDocument, type ResumeDocument } from "@/lib/career/document";
import type { CareerProfile } from "@/lib/career/types";

/**
 * Résumé Lab.
 *
 * Reads the profile the app already stores, projects it into a Career Evidence
 * Graph, and edits a saved version of it. No schema migration and nothing to
 * re-enter.
 *
 * Saving is explicit rather than automatic. A résumé is a document someone
 * deliberately shapes before sending it, and silently persisting every
 * intermediate rearrangement would make "what does my résumé currently say?"
 * unanswerable. The page instead tracks unsaved changes and says so.
 */

interface SavedVersion {
  id: string;
  name: string;
  templateId: string;
  sections: ResumeDocument["sections"];
  isMaster: boolean;
}

type LoadState = "loading" | "ready" | "empty" | "error";

export default function ResumeLabPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [document, setDocument] = useState<ResumeDocument | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Held in a ref as well as state: the save handler must read the latest
  // document without being re-created on every keystroke-level edit.
  const latest = useRef<ResumeDocument | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [profileRes, versionsRes] = await Promise.all([
          authedFetch(`/api/profile?userId=${user.uid}`),
          authedFetch("/api/resume/versions"),
        ]);
        const profileData = await profileRes.json();
        const versionsData = await versionsRes.json().catch(() => ({}));
        if (cancelled) return;

        const stored: StoredProfile | undefined = profileData?.profile;
        if (!stored || ((stored.skills?.length ?? 0) === 0 && (stored.experience?.length ?? 0) === 0)) {
          setState("empty");
          return;
        }

        const career = toCareerProfile({ ...stored, fromResume: Boolean(stored.resumeText) });
        setProfile(career);

        // Prefer a saved version; otherwise derive a starting document. Either
        // way the editor opens on something real.
        const saved: SavedVersion | undefined = versionsData?.versions?.[0];
        const doc: ResumeDocument = saved
          ? { id: saved.id, name: saved.name, templateId: saved.templateId, sections: saved.sections }
          : buildDocument(career);

        setDocument(doc);
        latest.current = doc;
        setVersionId(saved?.id ?? null);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const handleChange = useCallback((doc: ResumeDocument) => {
    latest.current = doc;
    setDirty(true);
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    const doc = latest.current;
    if (!doc) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await authedFetch("/api/resume/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: versionId ?? undefined,
          name: doc.name,
          templateId: doc.templateId,
          sections: doc.sections,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // The version limit is a plan boundary, not a failure — it is reported
        // in the API's own words so the message stays truthful if the plan changes.
        setNotice({ tone: "error", text: data.error || "Could not save. Try again." });
        return;
      }
      setVersionId(data.id);
      setDirty(false);
      setNotice({ tone: "ok", text: "Saved" });
    } catch {
      setNotice({ tone: "error", text: "Network problem — your changes are still here, try again." });
    } finally {
      setSaving(false);
    }
  }, [versionId]);

  // Leaving with unsaved work should cost a confirmation, since the editor is
  // the only place these decisions exist until they are saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Résumé Lab</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Your career is a set of evidence. A résumé is one view of it — choose what belongs on
              this version and see what it actually proves.
            </p>
          </div>

          {state === "ready" && (
            <div className="flex items-center gap-3">
              {notice && (
                <span
                  className={`text-xs flex items-center gap-1 ${notice.tone === "ok" ? "text-muted-foreground" : "text-primary"}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  {notice.tone === "ok" ? <Check className="w-3.5 h-3.5" aria-hidden /> : <AlertCircle className="w-3.5 h-3.5" aria-hidden />}
                  {notice.text}
                </span>
              )}
              {dirty && !notice && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="text-sm font-medium px-3 py-1.5 border border-border hover:bg-secondary/70 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" aria-hidden />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {state === "loading" && (
          <div className="space-y-2" role="status" aria-live="polite">
            <span className="sr-only">Loading your career evidence</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 bg-secondary/70 animate-pulse" style={{ width: `${80 - i * 20}%` }} />
            ))}
          </div>
        )}

        {state === "empty" && (
          <div className="border border-border/60 p-6 max-w-xl">
            <h2 className="text-sm font-semibold text-foreground">Your career story starts here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your résumé on your profile and we&apos;ll turn it into editable evidence —
              projects, skills and results you can rearrange for any role.
            </p>
            <button
              onClick={() => router.push("/profile")}
              className="mt-4 text-sm font-medium border border-border px-3 py-1.5 hover:bg-secondary/70 transition-colors"
            >
              Go to your profile
            </button>
          </div>
        )}

        {state === "error" && (
          <p className="text-sm text-foreground" role="alert">
            We couldn&apos;t load your career evidence. Refresh to try again.
          </p>
        )}

        {state === "ready" && profile && document && (
          <ResumeEditor profile={profile} initialDocument={document} onChange={handleChange} />
        )}
      </main>
      <Footer />
    </>
  );
}
