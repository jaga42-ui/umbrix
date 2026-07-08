"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { Header } from "@/components/Header";
import { JobCard } from "@/components/JobCard";
import { Compass, Search, MapPin, Tag, SlidersHorizontal, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FeedPage() {
  const { user, loading, isDemoMode } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [fetchingJobs, setFetchingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSkills, setHasSkills] = useState(true);

  // Filter and search states
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Fetch jobs & saved application list to highlight already-saved jobs
  const fetchJobsAndSaved = async () => {
    if (!user) return;
    setFetchingJobs(true);
    try {
      // 1. Fetch jobs
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (locationFilter) queryParams.set("location", locationFilter);
      if (selectedTag) queryParams.set("tag", selectedTag);

      const headers: { [key: string]: string } = {};
      if (isDemoMode) {
        const demoProfile = JSON.parse(localStorage.getItem("umbrix_demo_profile") || "{}");
        const demoSkills = demoProfile.skills || ["React", "TypeScript", "Next.js", "Node.js", "TailwindCSS", "Figma", "Git"];
        headers["x-guest-skills"] = JSON.stringify(demoSkills);
      } else {
        queryParams.set("userId", user.uid);
      }

      const jobsRes = await authedFetch(`/api/jobs?${queryParams.toString()}`, { headers });
      const jobsData = await jobsRes.json();

      if (jobsData.success) {
        setJobs(jobsData.jobs || []);
        setHasSkills(jobsData.hasSkills !== false);
      } else {
        throw new Error(jobsData.error || "Failed to fetch jobs");
      }

      // 2. Fetch saved applications to mark already-saved items
      const trackerRes = await authedFetch(`/api/tracker?userId=${user.uid}`);
      const trackerData = await trackerRes.json();

      if (trackerData.success) {
        let savedIds = new Set<string>();
        
        if (trackerData.isDemo) {
          // Retrieve from local storage demo applications
          const demoApps = JSON.parse(localStorage.getItem("umbrix_demo_applications") || "[]");
          demoApps.forEach((app: any) => {
            if (app.jobId) savedIds.add(app.jobId);
          });
        } else {
          trackerData.applications.forEach((app: any) => {
            if (app.jobId) savedIds.add(app.jobId);
          });
        }
        
        setSavedJobIds(savedIds);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to fetch feed data");
    } finally {
      setFetchingJobs(false);
    }
  };

  useEffect(() => {
    if (user && !loading) {
      fetchJobsAndSaved();
    }
  }, [user, loading, search, locationFilter, selectedTag]);

  const handleSaveJob = async (job: any) => {
    if (!user) return;
    
    try {
      const payload = {
        userId: user.uid,
        title: job.title,
        company: job.companyName || job.companySlug,
        location: job.location,
        stage: "Saved",
        applyUrl: job.applyUrl,
        jobId: job._id,
        notes: `Saved from Daily Discovery Feed. Match score: ${job.matchScore}%.`,
      };

      const res = await authedFetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        // Handle local storage fallback if API returned demo mode
        if (data.isDemo) {
          const demoApps = JSON.parse(localStorage.getItem("umbrix_demo_applications") || "[]");
          // Generate a random ID for the local mock app
          const localApp = {
            ...payload,
            id: `local-task-${Date.now()}`,
            _id: `local-task-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          demoApps.push(localApp);
          localStorage.setItem("umbrix_demo_applications", JSON.stringify(demoApps));
        }

        // Add to saved IDs set locally to update the UI button state immediately
        setSavedJobIds((prev) => {
          const updated = new Set(prev);
          updated.add(job._id);
          return updated;
        });
      } else {
        throw new Error(data.error || "Failed to save to tracker");
      }
    } catch (err) {
      console.error("Save to tracker failed:", err);
      alert("Could not save to tracker, please try again.");
    }
  };

  if (loading || (!user && !error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Initializing feed...</p>
        </div>
      </div>
    );
  }

  // Pre-populated filters for visual discovery
  const popularTags = ["Engineering", "Design", "Remote", "React", "TypeScript", "Next.js"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
        {/* Profile incomplete warning / Callout banner */}
        {!hasSkills && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">Complete Your AI Match Profile</h4>
                <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                  You haven't uploaded a resume yet. Upload one now to unlock custom compatibility scores for each role.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/profile")}
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all self-start sm:self-auto shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Upload Resume</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Intro Section */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2.5">
              <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                <Compass className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Daily Discovery</h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              A curated selection of career opportunities refined by AI to match your preferences.
            </p>
          </div>

          {/* Quick Stats */}
          {jobs.length > 0 && !fetchingJobs && (
            <div className="text-xs bg-secondary/50 border border-border px-3 py-1.5 rounded-lg text-muted-foreground self-start md:self-auto">
              Showing <span className="font-semibold text-foreground">{jobs.length}</span> matching opportunities
            </div>
          )}
        </div>

        {/* Search & Filtering Dashboard */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search roles, companies, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-secondary/30 border border-border h-11 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all placeholder:text-muted-foreground/75"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 w-full md:w-auto">
              {/* Location Select */}
              <div className="relative flex-1 md:flex-initial">
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full md:w-44 bg-secondary/30 border border-border h-11 pl-3 pr-8 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 appearance-none cursor-pointer"
                >
                  <option value="">All Locations</option>
                  <option value="remote">Remote Only</option>
                  <option value="San Francisco">San Francisco, CA</option>
                </select>
                <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>

              {/* Tag Dropdown */}
              <div className="relative flex-1 md:flex-initial">
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full md:w-44 bg-secondary/30 border border-border h-11 pl-3 pr-8 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 appearance-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  <option value="engineering">Engineering</option>
                  <option value="design">Design</option>
                  <option value="product">Product</option>
                  <option value="react">React</option>
                  <option value="typescript">TypeScript</option>
                </select>
                <Tag className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scrollbar-thin">
            <span className="text-xs text-muted-foreground flex items-center shrink-0">
              <SlidersHorizontal className="w-3 h-3 mr-1.5" />
              Quick Filters:
            </span>
            <button
              onClick={() => {
                setSelectedTag("");
                setLocationFilter("");
              }}
              className={`text-xs px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 ${
                !selectedTag && !locationFilter
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              All Matches
            </button>
            {popularTags.map((tag) => {
              const isSelected =
                selectedTag.toLowerCase() === tag.toLowerCase() ||
                (tag.toLowerCase() === "remote" && locationFilter.toLowerCase() === "remote");
              
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (tag.toLowerCase() === "remote") {
                      setLocationFilter(locationFilter === "remote" ? "" : "remote");
                    } else {
                      setSelectedTag(selectedTag.toLowerCase() === tag.toLowerCase() ? "" : tag.toLowerCase());
                    }
                  }}
                  className={`text-xs px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl mb-6">
            Error loading feed: {error}. Falling back to default matches.
          </div>
        )}

        {/* Jobs Feed List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {fetchingJobs ? (
              // Visual skeletons for loading state
              Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="bg-card border border-border/80 p-6 rounded-2xl space-y-4 animate-pulse"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2.5 flex-1">
                      <div className="h-6 bg-secondary/80 rounded-lg w-1/3" />
                      <div className="h-4 bg-secondary/60 rounded-lg w-1/4" />
                    </div>
                    <div className="h-10 bg-secondary/80 rounded-xl w-24" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-5 bg-secondary/60 rounded-md w-16" />
                    <div className="h-5 bg-secondary/60 rounded-md w-20" />
                  </div>
                  <div className="h-16 bg-secondary/40 rounded-xl w-full" />
                </div>
              ))
            ) : jobs.length === 0 ? (
              // Empty State
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-secondary/20 rounded-2xl border border-dashed border-border"
              >
                <div className="inline-flex p-3 bg-secondary/80 rounded-2xl border border-border text-muted-foreground mb-4">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-1">No matches found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto px-4">
                  We couldn't find any opportunities matching your current search parameters. Try expanding your filters.
                </p>
              </motion.div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job._id || job.id}
                  id={job._id || job.id}
                  title={job.title}
                  company={job.companyName || job.companySlug.charAt(0).toUpperCase() + job.companySlug.slice(1)}
                  location={job.location}
                  tags={job.tags}
                  matchSummary={job.matchSummary}
                  matchScore={job.matchScore}
                  matchingSkills={job.matchingSkills}
                  missingSkills={job.missingSkills}
                  matchExplanation={job.matchExplanation}
                  applyUrl={job.applyUrl}
                  isSaved={savedJobIds.has(job._id || job.id)}
                  onSave={() => handleSaveJob(job)}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* End of Feed Sign */}
        {!fetchingJobs && jobs.length > 0 && (
          <div className="mt-14 text-center border-t border-border/50 pt-8">
            <div className="inline-flex p-2 bg-secondary/30 rounded-xl border border-border/50 text-primary mb-3">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              You have completed today's discovery review.
            </p>
            <p className="text-xs text-muted-foreground/75 mt-1">
              New matching opportunities ingest daily from Greenhouse partner boards.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
