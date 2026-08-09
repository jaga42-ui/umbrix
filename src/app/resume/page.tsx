"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { toCareerProfile, type StoredProfile } from "@/lib/career/adapt";
import type { CareerProfile } from "@/lib/career/types";

/**
 * Résumé Lab.
 *
 * Reads the profile the app already stores and projects it into a Career
 * Evidence Graph, so the editor works on the candidate's real history without a
 * schema migration or asking them to re-enter anything.
 *
 * The document itself is not persisted yet — this is the editing surface, and
 * versioning is a later phase. That is stated plainly in the UI rather than
 * letting someone rearrange a résumé and lose it on refresh.
 */
export default function ResumeLabPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(`/api/profile?userId=${user.uid}`);
        const data = await res.json();
        if (cancelled) return;

        const stored: StoredProfile | undefined = data?.profile;
        // No skills and no history means nothing has been uploaded yet.
        if (!stored || ((stored.skills?.length ?? 0) === 0 && (stored.experience?.length ?? 0) === 0)) {
          setState("empty");
          return;
        }
        setProfile(toCareerProfile({ ...stored, fromResume: Boolean(stored.resumeText) }));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Résumé Lab</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Your career is a set of evidence. A résumé is one view of it — choose what belongs on
            this version and see what it actually proves.
          </p>
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

        {state === "ready" && profile && (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Changes here aren&apos;t saved yet — saved versions are coming next.
            </p>
            <ResumeEditor profile={profile} />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
