"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TrackerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Route protection redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || (!user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-10 flex flex-col">
        {/* Page Title & Intro */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-3 mb-2.5">
            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Application Tracker</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Track your pipeline stages. Drag cards to update application statuses, add notes, or manage details.
          </p>
        </motion.div>

        {/* Kanban Board Area */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex-1 min-h-0"
        >
          <KanbanBoard />
        </motion.div>
      </main>
    </div>
  );
}
