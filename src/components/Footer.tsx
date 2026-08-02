"use client";

import Link from "next/link";
import Image from "next/image";

const FIELDS: [string, string][] = [
  ["IT & Software", "it"], ["Engineering", "engineering"], ["Sales", "sales"], ["Marketing", "marketing"],
  ["Finance & Accounting", "finance"], ["Customer Service & BPO", "customer-service"], ["HR & Recruiting", "hr"],
  ["Admin & Operations", "admin"], ["Retail", "retail"], ["Logistics & Supply Chain", "logistics"],
  ["Healthcare", "healthcare"], ["Teaching & Education", "teaching"], ["Hospitality", "hospitality"],
  ["Creative & Design", "creative"], ["Consulting", "consultancy"], ["Manufacturing", "manufacturing"],
];

const CITIES: [string, string][] = [
  ["Bengaluru", "bengaluru"], ["Delhi", "delhi"], ["Mumbai", "mumbai"], ["Pune", "pune"],
  ["Hyderabad", "hyderabad"], ["Chennai", "chennai"], ["Gurgaon", "gurgaon"], ["Noida", "noida"],
  ["Kolkata", "kolkata"], ["Ahmedabad", "ahmedabad"], ["Jaipur", "jaipur"], ["Kochi", "kochi"],
];

export function Footer() {
  return (
    <footer className="um-footer" style={{ background: "var(--um-bg)", borderTop: "1px solid var(--um-divider)" }}>
      <div className="um-wrap" style={{ padding: "clamp(44px,6vw,72px) clamp(16px,4vw,40px)" }}>
        <div className="um-foot-cols">
          <div style={{ minWidth: 0 }}>
            <Image
              src="/umbrix-emblem.png"
              alt="Umbrix"
              width={619}
              height={586}
              style={{ width: "auto", height: 60, marginBottom: 16 }}
            />
            <div
              style={{
                fontFamily: "var(--um-logo)",
                fontWeight: 300,
                fontSize: 24,
                letterSpacing: "0.26em",
                textIndent: "0.26em",
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              UMBRIX
            </div>
            <div
              style={{
                fontFamily: "var(--um-logo)",
                fontWeight: 400,
                fontSize: 9,
                letterSpacing: "0.28em",
                textIndent: "0.28em",
                color: "var(--um-n700)",
                marginBottom: 16,
              }}
            >
              FOLLOW YOUR NORTH STAR.
            </div>
            <p className="um-muted" style={{ fontSize: 13, maxWidth: "34ch" }}>
              Real, scam-checked, fresher-eligible jobs across every field. Built in India.
            </p>
            <a href="https://www.umbrix.in" style={{ fontSize: 13 }}>
              www.umbrix.in
            </a>
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="um-collabel">Jobs by field</div>
            <div className="um-linkgrid">
              {FIELDS.map(([label, slug]) => (
                <Link key={slug} href={`/jobs/${slug}`}>
                  {label}
                </Link>
              ))}
            </div>
            <div className="um-collabel" style={{ marginTop: 28 }}>
              Jobs by city
            </div>
            <div className="um-linkgrid">
              {CITIES.map(([label, slug]) => (
                <Link key={slug} href={`/jobs/it/${slug}`}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="um-collabel">Product</div>
            <div className="um-linkgrid" style={{ flexDirection: "column", gap: 9 }}>
              <Link href="/feed">Discovery feed</Link>
              <Link href="/tracker">Application tracker</Link>
              <Link href="/scam-check">Scam Check</Link>
              <Link href="/profile">Profile</Link>
              <Link href="/jobs">All jobs</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "2px solid var(--um-divider)",
            paddingTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 32px",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--um-n700)",
          }}
        >
          <span>
            © {new Date().getFullYear()} Umbrix. Jobs sourced from public ATS APIs. We never charge you to apply.
          </span>
          <span>Feed refreshed daily · 00:00 &amp; 04:00 UTC</span>
        </div>
      </div>
    </footer>
  );
}
