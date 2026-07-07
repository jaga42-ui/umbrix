"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
  const { user, loading, signInWithGoogle, isDemoMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push("/feed");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <main className="max-w-2xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-2 bg-secondary/50 rounded-full px-3 py-1 mb-8 border border-border">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{isDemoMode ? "Demo Mode Active" : "Early Access MVP"}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Discover Your Next <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">
              Great Opportunity.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto leading-relaxed">
            HIKARI is an exclusive career discovery platform. We cut through the noise to bring you roles tailored to your exact skillset.
          </p>

          <div className="max-w-md mx-auto space-y-4">
            <button
              onClick={signInWithGoogle}
              className="w-full bg-primary text-primary-foreground h-12 rounded-xl font-medium flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>{isDemoMode ? "Sign in as Guest Developer" : "Sign in with Google"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            {isDemoMode && (
              <p className="text-xs text-muted-foreground/80 font-medium">
                No database or Firebase setup required. Click above to try it instantly.
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
