"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { track } from "@/lib/analytics";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ResumeAnalysis } from "@/components/ResumeAnalysis";
import { 
  User as UserIcon, 
  Mail, 
  Briefcase, 
  GraduationCap, 
  UploadCloud, 
  FileText, 
  Plus, 
  X, 
  Sparkles, 
  Save, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Experience {
  role: string;
  company: string;
  duration?: string;
  description?: string;
}

interface Profile {
  name: string;
  email?: string;
  title?: string;
  summary?: string;
  skills: string[];
  experience: Experience[];
  education: string[];
  visibleToRecruiters?: boolean;
}

const DEFAULT_GUEST_PROFILE: Profile = {
  name: "Hiroshi Tanaka",
  email: "hiroshi.tanaka@umbrix.io",
  title: "Senior Product Engineer",
  summary: "Creative and performance-focused engineer with 6+ years of experience building premium dashboards, responsive SaaS platforms, and animated design systems.",
  skills: ["React", "TypeScript", "Next.js", "Node.js", "TailwindCSS", "Figma", "Git"],
  experience: [
    {
      role: "Senior Product Engineer",
      company: "NextGen UI",
      duration: "2023 - Present",
      description: "Architected and built glassmorphic design systems using React, TailwindCSS, and Framer Motion. Reduced bundle size by 40%."
    },
    {
      role: "Frontend Developer",
      company: "Vivid Studio",
      duration: "2020 - 2023",
      description: "Collaborated with designers to deliver beautiful interactive web experiences. Handled TypeScript refactoring and CI/CD pipelines."
    }
  ],
  education: ["B.S. in Computer Science - Kyoto University"]
};

export default function ProfilePage() {
  const { user, loading, isDemoMode } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resume Upload States
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Skills found on the most recent upload — drives the "see your matches" loop-closer.
  const [justParsedCount, setJustParsedCount] = useState<number | null>(null);

  // Skills input state
  const [newSkill, setNewSkill] = useState("");

  // Experience forms state
  const [newRole, setNewRole] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Education input state
  const [newEducation, setNewEducation] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Fetch user profile on mount
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setFetchingProfile(true);
      try {
        if (isDemoMode) {
          const saved = localStorage.getItem("umbrix_demo_profile");
          if (saved) {
            setProfile(JSON.parse(saved));
          } else {
            setProfile(DEFAULT_GUEST_PROFILE);
            localStorage.setItem("umbrix_demo_profile", JSON.stringify(DEFAULT_GUEST_PROFILE));
          }
        } else {
          const res = await authedFetch(`/api/profile?userId=${user.uid}`);
          const data = await res.json();
          if (res.ok && data.profile) {
            setProfile(data.profile);
          } else {
            // Fallback default for DB mode if no profile exists yet
            const emptyProfile = {
              name: user.displayName || "Developer Profile",
              email: user.email || "",
              title: "Software Engineer",
              summary: "Upload your resume to get started with personalized matching.",
              skills: [],
              experience: [],
              education: [],
            };
            setProfile(emptyProfile);
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
        setErrorMessage("Failed to load profile details.");
      } finally {
        setFetchingProfile(false);
      }
    };

    fetchProfile();
  }, [user, isDemoMode]);

  // Trigger transient alerts
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save changes handler
  const handleSaveProfile = async (updatedProfile: Profile) => {
    if (!user || !updatedProfile) return;
    setSavingProfile(true);
    setErrorMessage(null);

    try {
      if (isDemoMode) {
        localStorage.setItem("umbrix_demo_profile", JSON.stringify(updatedProfile));
        setProfile(updatedProfile);
        triggerSuccess("Profile saved to local storage!");
      } else {
        const res = await authedFetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.uid,
          },
          body: JSON.stringify(updatedProfile),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.isDemo) {
            localStorage.setItem("umbrix_demo_profile", JSON.stringify(updatedProfile));
            setProfile(updatedProfile);
            triggerSuccess("Database offline: Saved to local storage!");
          } else {
            setProfile(data.profile);
            triggerSuccess("Profile updated in database!");
          }
        } else {
          throw new Error(data.error || "Failed to update profile");
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Failed to save changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  // Handle Drag Leave
  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // Handle File Input Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  // File Upload Process
  const handleFileUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMessage("Only PDF files are supported.");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("File exceeds 5MB size limit.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate parsing visual state
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      const headers: { [key: string]: string } = {};
      if (user) {
        headers["x-user-id"] = user.uid;
      }

      const res = await authedFetch("/api/profile", {
        method: "POST",
        headers,
        body: formData
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.profile);
        const skillCount = Array.isArray(data.profile?.skills) ? data.profile.skills.length : 0;
        track("resume_upload", {
          skills: skillCount,
          fields: Array.isArray(data.profile?.targetFields) ? data.profile.targetFields.length : 0,
        });
        // Show the loop-closer only when we actually found skills to match on.
        setJustParsedCount(skillCount > 0 ? skillCount : null);

        if (isDemoMode || data.isDemo) {
          // Sync demo local storage profile
          localStorage.setItem("umbrix_demo_profile", JSON.stringify(data.profile));
        }

        triggerSuccess(data.isDemo ? "Saved locally — the database is offline right now." : "Résumé read. Your skills are below.");
      } else {
        throw new Error(data.error || "Failed to parse resume");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Failed to upload and parse resume.");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 400);
    }
  };

  // Add/Remove Skills
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newSkill.trim()) return;
    
    const skillNormalized = newSkill.trim();
    if (profile.skills.some(s => s.toLowerCase() === skillNormalized.toLowerCase())) {
      setNewSkill("");
      return;
    }

    const updated = {
      ...profile,
      skills: [...profile.skills, skillNormalized]
    };
    setProfile(updated);
    handleSaveProfile(updated);
    setNewSkill("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!profile) return;
    const updated = {
      ...profile,
      skills: profile.skills.filter(s => s !== skillToRemove)
    };
    setProfile(updated);
    handleSaveProfile(updated);
  };

  // Add/Remove Experience
  const handleAddExperience = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newRole.trim() || !newCompany.trim()) return;

    const newExp: Experience = {
      role: newRole.trim(),
      company: newCompany.trim(),
      duration: newDuration.trim() || "Present",
      description: newDescription.trim() || undefined
    };

    const updated = {
      ...profile,
      experience: [...profile.experience, newExp]
    };

    setProfile(updated);
    handleSaveProfile(updated);

    // Reset fields
    setNewRole("");
    setNewCompany("");
    setNewDuration("");
    setNewDescription("");
  };

  const handleRemoveExperience = (index: number) => {
    if (!profile) return;
    const updated = {
      ...profile,
      experience: profile.experience.filter((_, i) => i !== index)
    };
    setProfile(updated);
    handleSaveProfile(updated);
  };

  // Add/Remove Education
  const handleAddEducation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newEducation.trim()) return;

    const updated = {
      ...profile,
      education: [...profile.education, newEducation.trim()]
    };

    setProfile(updated);
    handleSaveProfile(updated);
    setNewEducation("");
  };

  const handleRemoveEducation = (index: number) => {
    if (!profile) return;
    const updated = {
      ...profile,
      education: profile.education.filter((_, i) => i !== index)
    };
    setProfile(updated);
    handleSaveProfile(updated);
  };

  if (loading || fetchingProfile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-medium">Loading your profile details...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="font-serif text-2xl font-semibold mb-2">Failed to load profile</h2>
          <p className="text-muted-foreground mb-4">We encountered an error loading your data.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      <Header />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 w-full mt-10 flex-1">
        
        {/* Alerts Banner */}
        <div className="mb-6 h-6 relative">
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-0 right-0 bg-secondary border border-stage-interview/25 text-stage-interview text-sm py-2 px-4 rounded-none flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-0 right-0 bg-destructive/10 border border-destructive/20 text-destructive text-sm py-2 px-4 rounded-none flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loop-closer: the whole point of uploading is to see personalized
            matches, so pull the user straight back to their ranked feed. */}
        <AnimatePresence>
          {justParsedCount != null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 bg-surface border border-border rounded-none p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary rounded-none text-accent mt-0.5 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-foreground">
                    We read your résumé — found {justParsedCount} skill{justParsedCount === 1 ? "" : "s"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your feed is now ranked for you, with a real match score and the &ldquo;why&rdquo; on every role.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/feed")}
                className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <span>See your matches</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">

          {/* Left Column: Profile Card + Upload Zone */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Profile Card */}
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 relative">
                {isDemoMode ? (
                  <img 
                    src={user.photoURL} 
                    alt={profile.name} 
                    className="w-full h-full rounded-full object-cover" 
                  />
                ) : (
                  <UserIcon className="w-10 h-10" />
                )}
                {isDemoMode && (
                  <span className="absolute -bottom-1 -right-1 bg-primary text-[8px] font-mono font-semibold uppercase text-primary-foreground px-1.5 py-0.5 rounded-full border border-card">
                    Guest
                  </span>
                )}
              </div>
              
              <input
                type="text"
                value={profile.name}
                onChange={(e) => handleSaveProfile({ ...profile, name: e.target.value })}
                className="font-serif text-xl font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-center px-2 py-0.5 rounded-md w-full mb-1"
                placeholder="Enter Name"
              />

              <input
                type="text"
                value={profile.title || ""}
                onChange={(e) => handleSaveProfile({ ...profile, title: e.target.value })}
                className="text-sm text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-center px-2 py-0.5 rounded-md w-full mb-4"
                placeholder="Enter Professional Title"
              />

              <div className="w-full border-t border-border/60 pt-4 space-y-3 text-sm text-left">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary/70 shrink-0" />
                  <input
                    type="email"
                    value={profile.email || ""}
                    onChange={(e) => handleSaveProfile({ ...profile, email: e.target.value })}
                    className="bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 rounded-sm w-full text-foreground text-xs"
                    placeholder="Enter email"
                  />
                </div>
              </div>
            </div>

            {/* Resume Upload Card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Upload your résumé</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Drop your résumé and we&rsquo;ll pull out your skills automatically — about 10 seconds.
              </p>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors relative flex flex-col items-center justify-center ${
                  isDragOver 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 bg-secondary/20"
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isUploading}
                />

                <AnimatePresence mode="wait">
                  {isUploading ? (
                    <motion.div 
                      key="uploading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-2"
                    >
                      <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                      <span className="text-xs font-semibold text-foreground">Reading your résumé… {uploadProgress}%</span>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-2"
                    >
                      <UploadCloud className="w-8 h-8 text-primary/70 mb-2" />
                      <span className="text-xs font-semibold text-foreground">Drag resume PDF here</span>
                      <span className="text-[10px] text-muted-foreground mt-1">or click to browse files</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Supported: PDF only</span>
                <span>Max Size: 5MB</span>
              </div>
            </div>

            {/* Recruiter visibility opt-in (default OFF — explicit consent) */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Let recruiters find you</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Turn this on and verified recruiters hiring freshers can discover you by your skills — shown
                anonymously (no name or contact) until they choose to unlock your profile. It&rsquo;s off by
                default, and you can turn it off any time.
              </p>
              <button
                onClick={() => handleSaveProfile({ ...profile, visibleToRecruiters: !profile.visibleToRecruiters })}
                aria-pressed={!!profile.visibleToRecruiters}
                className={`w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  profile.visibleToRecruiters
                    ? "bg-accent/10 text-accent border-accent/30"
                    : "bg-background text-foreground border-border hover:bg-secondary hover:border-foreground/20"
                }`}
              >
                {profile.visibleToRecruiters ? (
                  <><CheckCircle2 className="w-4 h-4" /> Visible to recruiters</>
                ) : (
                  "Make me visible to recruiters"
                )}
              </button>
            </div>

          </div>

          {/* Right Column: Details Forms */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Professional Summary */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Professional Summary</span>
              </h3>
              <textarea
                value={profile.summary || ""}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                onBlur={() => handleSaveProfile(profile)}
                rows={4}
                className="w-full bg-secondary/35 border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder-muted-foreground/60"
                placeholder="Write a brief professional summary about your skills, experience, and background..."
              />
              <div className="mt-2 flex justify-end text-xs text-muted-foreground">
                <span>Changes auto-save on blur</span>
              </div>
            </div>

            {/* Résumé analysis. Sits directly under the summary and above the
                skills the analysis talks about, so a finding like "only 3
                skills detected" is next to the list it refers to. `hasResume`
                is keyed on extracted skills: if the parser got nothing there is
                nothing to analyse, and the panel invites an upload instead. */}
            <ResumeAnalysis hasResume={profile.skills.length > 0} />

            {/* Skills manager */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>Your skills</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                We match these against every job. Tap a skill to remove it, or add your own below.
              </p>

              {/* Skills cloud */}
              <div className="flex flex-wrap gap-2 mb-4 min-h-12 border border-border/40 p-3 rounded-xl bg-secondary/15">
                {profile.skills.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic flex items-center">No skills yet — upload your résumé above and we&rsquo;ll fill this in.</span>
                ) : (
                  profile.skills.map((skill, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-2.5 py-1 rounded-full"
                    >
                      {skill}
                      <button 
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-destructive hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer"
                        title={`Remove ${skill}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add skill input */}
              <form onSubmit={handleAddSkill} className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add custom skill (e.g. Docker, Rust)..."
                  className="flex-1 bg-secondary/35 border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-3 rounded-xl font-semibold text-xs flex items-center gap-1 hover:opacity-90 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Experience list */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <span>Work Experience</span>
              </h3>

              {/* Existing experiences list */}
              <div className="space-y-4 mb-6">
                {profile.experience.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No work experiences listed.</p>
                ) : (
                  profile.experience.map((exp, idx) => (
                    <div key={idx} className="border border-border/50 bg-secondary/10 p-4 rounded-xl relative group">
                      <button
                        onClick={() => handleRemoveExperience(idx)}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove experience"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      <div className="flex flex-col md:flex-row md:justify-between mb-1.5">
                        <h4 className="font-bold text-sm text-foreground">{exp.role}</h4>
                        <span className="text-xs text-muted-foreground font-medium">{exp.duration}</span>
                      </div>
                      
                      <div className="text-xs text-primary font-semibold mb-2">{exp.company}</div>
                      {exp.description && (
                        <p className="text-xs text-muted-foreground/90 leading-relaxed font-light">{exp.description}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add experience form */}
              <form onSubmit={handleAddExperience} className="border-t border-border/40 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-foreground">Add Experience Record</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Role Title (e.g. Product Designer)"
                    className="bg-secondary/35 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  />
                  <input
                    type="text"
                    required
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Company name"
                    className="bg-secondary/35 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  />
                  <input
                    type="text"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="Duration (e.g. 2022 - Present)"
                    className="bg-secondary/35 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  />
                </div>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Role description - describe your responsibilities, technologies used, and outcomes..."
                  rows={2}
                  className="w-full bg-secondary/35 border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                <button
                  type="submit"
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-secondary/80 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Experience</span>
                </button>
              </form>
            </div>

            {/* Education list */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span>Education</span>
              </h3>

              <div className="space-y-2 mb-4">
                {profile.education.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No education history listed.</p>
                ) : (
                  profile.education.map((edu, idx) => (
                    <div key={idx} className="flex items-center justify-between border border-border/40 bg-secondary/10 px-4 py-2.5 rounded-xl group text-xs">
                      <span className="font-medium">{edu}</span>
                      <button
                        onClick={() => handleRemoveEducation(idx)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove education"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddEducation} className="flex gap-2 max-w-md border-t border-border/40 pt-4">
                <input
                  type="text"
                  value={newEducation}
                  onChange={(e) => setNewEducation(e.target.value)}
                  placeholder="Add degree or school (e.g. B.S. in CS - MIT)..."
                  className="flex-1 bg-secondary/35 border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="bg-secondary text-secondary-foreground px-3 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-secondary/80 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
