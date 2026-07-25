"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Compass, LayoutDashboard, LogOut, ShieldCheck, Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";

export function Header() {
  const { user, isDemoMode, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        {/* Brand Logo */}
        <div className="flex items-center space-x-8">
          <Link href="/feed" className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-lg font-mono font-semibold tracking-[0.2em]">
              UMBRIX
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <Link href="/feed">
              <span
                className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-xl ${
                  isActive("/feed")
                    ? "text-primary bg-secondary/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Compass className="w-4 h-4" />
                Daily Discovery
                {isActive("/feed") && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute bottom-[-1px] left-4 right-4 h-0.5 bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </span>
            </Link>
            <Link href="/profile">
              <span
                className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-xl ${
                  isActive("/profile")
                    ? "text-primary bg-secondary/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <User className="w-4 h-4" />
                My Profile
                {isActive("/profile") && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute bottom-[-1px] left-4 right-4 h-0.5 bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </span>
            </Link>
            <Link href="/tracker">
              <span
                className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-xl ${
                  isActive("/tracker")
                    ? "text-primary bg-secondary/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                App Tracker
                {isActive("/tracker") && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute bottom-[-1px] left-4 right-4 h-0.5 bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </span>
            </Link>
            <Link href="/scam-check">
              <span
                className={`relative px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-xl ${
                  isActive("/scam-check")
                    ? "text-primary bg-secondary/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Scam Check
                {isActive("/scam-check") && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute bottom-[-1px] left-4 right-4 h-0.5 bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </span>
            </Link>
          </nav>
        </div>

        {/* Profile / Demo status */}
        <div className="flex items-center space-x-4">
          {isDemoMode && (
            <div className="hidden sm:inline-flex items-center space-x-1.5 bg-secondary border border-border text-muted-foreground text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>Demo Mode</span>
            </div>
          )}

          {/* User profile card & Log out */}
          <div className="flex items-center space-x-3 bg-secondary/30 border border-border/50 py-1.5 pl-2.5 pr-1.5 rounded-xl">
            {/* User Avatar */}
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-7 h-7 rounded-full border border-border/80"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono font-semibold text-xs">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
              </div>
            )}
            
            {/* Display Name */}
            <div className="hidden md:flex flex-col text-left mr-2">
              <span className="text-xs font-semibold leading-tight text-foreground">
                {user.displayName || "Guest Profile"}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[120px]">
                {user.email}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation — icon-first tab bar so all four destinations fit on
          a narrow phone (Scam Check is a public growth wedge; it must be
          reachable on mobile, where most users are). */}
      <div className="flex md:hidden border-t border-border/50 bg-background/90 px-2 py-1.5 justify-around">
        <Link href="/feed" className="flex-1 flex justify-center">
          <span className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 px-2 rounded-lg w-full ${isActive("/feed") ? "text-primary bg-secondary" : "text-muted-foreground"}`}>
            <Compass className="w-5 h-5" />
            Feed
          </span>
        </Link>
        <Link href="/profile" className="flex-1 flex justify-center">
          <span className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 px-2 rounded-lg w-full ${isActive("/profile") ? "text-primary bg-secondary" : "text-muted-foreground"}`}>
            <User className="w-5 h-5" />
            Profile
          </span>
        </Link>
        <Link href="/tracker" className="flex-1 flex justify-center">
          <span className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 px-2 rounded-lg w-full ${isActive("/tracker") ? "text-primary bg-secondary" : "text-muted-foreground"}`}>
            <LayoutDashboard className="w-5 h-5" />
            Tracker
          </span>
        </Link>
        <Link href="/scam-check" className="flex-1 flex justify-center">
          <span className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 px-2 rounded-lg w-full ${isActive("/scam-check") ? "text-primary bg-secondary" : "text-muted-foreground"}`}>
            <ShieldCheck className="w-5 h-5" />
            Scam Check
          </span>
        </Link>
      </div>
    </header>
  );
}
