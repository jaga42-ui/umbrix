"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { FIELD_LABELS } from "@/lib/seoFields";
import { Search, Loader2, Lock, Unlock, GraduationCap, Briefcase, Mail, Copy, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";

const FIELD_OPTIONS = Object.entries(FIELD_LABELS);

export default function RecruiterSearchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "notRecruiter" | "ready">("loading");
  const [uid, setUid] = useState("");
  const [account, setAccount] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const [skill, setSkill] = useState("");
  const [field, setField] = useState("");
  const [fresher, setFresher] = useState(false);
  const [minMatch, setMinMatch] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (skill.trim()) params.set("skill", skill.trim());
      if (field) params.set("field", field);
      if (fresher) params.set("fresher", "1");
      if (minMatch) params.set("minMatch", String(minMatch));
      const res = await authedFetch(`/api/recruiter/search?${params.toString()}`);
      const data = await res.json();
      if (res.status === 403 && data.code === "NOT_RECRUITER") {
        setUid(data.userId || "");
        setStatus("notRecruiter");
        return;
      }
      if (data.success) {
        setAccount(data.account);
        setCandidates(data.candidates || []);
        setStatus("ready");
      } else {
        setError(data.error || "Search failed.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSearching(false);
    }
  }, [skill, field, fresher, minMatch]);

  // First load: an empty search doubles as the recruiter-access check.
  useEffect(() => {
    if (user) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const unlock = async (id: string) => {
    setUnlockingId(id);
    setError(null);
    try {
      const res = await authedFetch("/api/recruiter/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setRevealed((r) => ({ ...r, [id]: data.candidate }));
        setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, unlocked: true } : c)));
        if (typeof data.creditsBalance === "number") setAccount((a: any) => ({ ...a, creditsBalance: data.creditsBalance }));
      } else {
        setError(data.error || "Couldn't unlock this candidate.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setUnlockingId(null);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Header = (
    <header className="border-b border-border bg-background">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="text-lg font-mono font-semibold tracking-[0.2em]">UMBRIX</span>
          <span className="ml-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
            Recruiter
          </span>
        </div>
        {account && (
          <div className="text-xs text-muted-foreground">
            {account.company} ·{" "}
            <span className="font-semibold text-foreground">
              {account.plan === "seat" ? "Monthly seat" : `${account.creditsBalance} credits`}
            </span>
          </div>
        )}
      </div>
    </header>
  );

  if (status === "notRecruiter") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {Header}
        <main className="flex-1 max-w-lg w-full mx-auto px-6 py-20 text-center">
          <div className="inline-flex p-3 bg-secondary rounded-none border border-border text-accent mb-5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight mb-2"
            style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
          >
            Recruiter access
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Umbrix candidate search is invite-only right now. Send us the account ID below and we&rsquo;ll set
            you up with credits.
          </p>
          <div className="bg-card border border-border rounded-none p-4 flex items-center justify-between gap-3">
            <code className="text-xs text-foreground break-all text-left">{uid}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(uid)}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-none border border-border hover:bg-secondary transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-4">
            Email it to <a href="mailto:recruiters@umbrix.in" className="text-accent underline">recruiters@umbrix.in</a>.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {Header}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1"
          style={{ fontFamily: "var(--um-heading)", color: "var(--um-text)" }}
        >
          Find candidates
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Search freshers who&rsquo;ve opted in to be discovered. Cards are anonymous until you unlock them.
        </p>

        {/* Filters */}
        <div className="bg-surface border border-border rounded-none p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Skills (comma-separated)"
            className="bg-background border border-border h-11 px-3 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 sm:col-span-2"
          />
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="bg-background border border-border h-11 px-3 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 cursor-pointer"
          >
            <option value="">All fields</option>
            {FIELD_OPTIONS.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <button
            onClick={runSearch}
            disabled={searching}
            className="um-btn um-btn--primary h-11 px-4 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            <input type="checkbox" checked={fresher} onChange={(e) => setFresher(e.target.checked)} className="accent-primary" />
            Freshers only (0–1 prior roles)
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            Min skill match
            <input type="range" min={0} max={100} step={10} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="font-mono text-xs w-9 text-right">{minMatch}%</span>
          </label>
        </div>

        {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-none px-4 py-2.5">{error}</div>}

        <div className="text-xs text-muted-foreground mb-3">{candidates.length} candidate{candidates.length === 1 ? "" : "s"}</div>

        {candidates.length === 0 ? (
          <div className="border border-dashed border-border rounded-none p-10 text-center text-muted-foreground">
            No opted-in candidates match yet. Widen your filters, or check back as more candidates join.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map((c) => {
              const pii = revealed[c.id];
              return (
                <div key={c.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1"><GraduationCap className="w-4 h-4 text-muted-foreground/70" />{c.educationLevel}</span>
                      <span className="inline-flex items-center gap-1"><Briefcase className="w-4 h-4 text-muted-foreground/70" />{c.experienceCount === 0 ? "Fresher" : `${c.experienceCount} role${c.experienceCount === 1 ? "" : "s"}`}</span>
                    </div>
                    {c.matchPct != null && (
                      <span className="font-mono text-sm font-semibold text-accent shrink-0">{c.matchPct}%</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {c.skills.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 text-xs bg-secondary/70 border border-border/40 rounded-md">{s}</span>
                    ))}
                  </div>
                  {c.fields?.length > 0 && (
                    <div className="text-xs text-muted-foreground mb-4">
                      Fields: {c.fields.map((f: string) => FIELD_LABELS[f] || f).join(", ")}
                    </div>
                  )}

                  {pii ? (
                    <div className="border-t border-border pt-3 mt-1 space-y-1.5 text-sm">
                      <div className="font-semibold text-foreground">{pii.name}</div>
                      {pii.email && (
                        <a href={`mailto:${pii.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline text-sm">
                          <Mail className="w-3.5 h-3.5" /> {pii.email}
                        </a>
                      )}
                      {pii.title && <div className="text-muted-foreground text-xs">{pii.title}</div>}
                    </div>
                  ) : (
                    <button
                      onClick={() => unlock(c.id)}
                      disabled={unlockingId === c.id}
                      className={`um-btn w-full h-10 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${
                        c.unlocked
                          ? "um-btn--secondary"
                          : "um-btn--primary"
                      }`}
                    >
                      {unlockingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : c.unlocked ? (
                        <><Unlock className="w-4 h-4" /> View details</>
                      ) : (
                        <><Lock className="w-4 h-4" /> Unlock contact {account?.plan === "payg" ? "(1 credit)" : ""}</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
