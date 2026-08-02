"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LogOut, Menu, X, Compass, LayoutDashboard, ShieldCheck, User, Briefcase } from "lucide-react";

export function Header() {
  const { user, isDemoMode, logout } = useAuth();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const navLinks = [
    { href: "/feed", label: "Daily Discovery", icon: Compass },
    { href: "/tracker", label: "App Tracker", icon: LayoutDashboard },
    { href: "/scam-check", label: "Scam Check", icon: ShieldCheck },
    { href: "/profile", label: "My Profile", icon: User },
    { href: "/jobs", label: "All Jobs", icon: Briefcase },
  ];

  return (
    <header
      className="um-header"
      style={{
        background: "var(--um-bg)",
        borderBottom: "1px solid var(--um-divider)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="um-wrap um-header__bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Brand Logo */}
        <Link href="/" className="um-brand" aria-label="Umbrix — home" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <Image src="/umbrix-emblem.png" alt="" width={619} height={586} priority style={{ width: "auto", height: 34 }} />
          <span
            style={{
              fontFamily: "var(--um-logo)",
              fontWeight: 400,
              fontSize: 18,
              letterSpacing: "0.26em",
              color: "var(--um-text)",
            }}
          >
            UMBRIX
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="um-nav hidden md:flex" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {navLinks.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  color: "var(--um-text)",
                  fontFamily: "var(--um-heading)",
                  fontWeight: active ? 800 : 600,
                  fontSize: 13,
                  textDecoration: active ? "underline" : "none",
                  textUnderlineOffset: "6px",
                  textDecorationThickness: "2px",
                  textDecorationColor: "var(--um-accent)",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth / User Controls */}
        <div className="um-auth hidden md:flex" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--um-text)" }}>
                  {user.displayName || (isDemoMode ? "Guest Profile" : "User Profile")}
                </span>
                <span style={{ fontSize: 10, color: "var(--um-n700)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                className="um-btn um-btn--secondary"
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href="/" className="um-btn um-btn--primary" style={{ padding: "8px 16px", fontSize: 13 }}>
                Sign in
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          className="um-burger md:hidden"
          aria-label="Menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          style={{
            background: "transparent",
            border: "1px solid var(--um-divider)",
            padding: 8,
            cursor: "pointer",
            color: "var(--um-text)",
          }}
        >
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Sheet */}
      {menu && (
        <div
          className="um-sheet md:hidden"
          style={{
            background: "var(--um-bg)",
            borderBottom: "2px solid var(--um-divider)",
            padding: "16px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenu(false)}
              style={{
                color: "var(--um-text)",
                fontFamily: "var(--um-heading)",
                fontWeight: isActive(l.href) ? 800 : 600,
                fontSize: 15,
                textDecoration: isActive(l.href) ? "underline" : "none",
                textUnderlineOffset: "4px",
                textDecorationThickness: "2px",
                textDecorationColor: "var(--um-accent)",
              }}
            >
              {l.label}
            </Link>
          ))}

          {user ? (
            <div style={{ borderTop: "1px solid var(--um-divider)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--um-text)" }}>
                  {user.displayName || (isDemoMode ? "Guest Profile" : "User")}
                </div>
                <div style={{ fontSize: 11, color: "var(--um-n700)" }}>{user.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  logout();
                }}
                className="um-btn um-btn--secondary"
                style={{ padding: "8px 14px", fontSize: 12, cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid var(--um-divider)", paddingTop: 16 }}>
              <Link
                href="/"
                onClick={() => setMenu(false)}
                className="um-btn um-btn--primary"
                style={{ display: "block", textAlign: "center", padding: "12px" }}
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
