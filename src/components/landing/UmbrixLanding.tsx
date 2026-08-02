"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, ArrowRight, Menu, X } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/umbrix-landing.css";

/* ── content ────────────────────────────────────────────────────────────── */

const NAV = [
  { label: "Find jobs", href: "#feed" },
  { label: "How it works", href: "#how" },
  { label: "Match score", href: "#match" },
  { label: "Scam Check", href: "#scam" },
  { label: "What's free", href: "#free" },
];

const TICKS = [
  "Official ATS APIs only — never scraped",
  "Every posting scam-scored before you see it",
  "Fresher eligibility read out of the JD itself",
  "Apply on the company's own careers page",
];

const STATS = [
  { n: 20000, comma: true, display: "20,000", label: "Active opportunities", sub: "Reconciled to Closed when they die" },
  { n: 6700, comma: true, display: "6,700", label: "India-based roles", sub: "The feed defaults to India" },
  { n: 160, comma: false, display: "160", label: "Companies polled by API", sub: "Four ATS boards + one aggregator" },
  { n: 11500, comma: true, display: "11,500", label: "Postings the filter was tested on", sub: "Zero legitimate jobs blocked" },
];

const SOURCES = ["Groww", "PhonePe", "CRED", "Meesho", "Paytm", "Freshworks", "InMobi", "fampay", "Swiggy", "Greenhouse", "Lever", "Ashby", "SmartRecruiters", "Adzuna"];

const STEPS = [
  { n: "01", t: "Sign in with Google", d: "One tap. No password to forget and nothing to verify by SMS. Google is the only way in — that's deliberate, and it's how we keep fake accounts out of the tracker." },
  { n: "02", t: "Drop in your résumé", d: "A PDF is enough. It's read into skills, education and target fields, and you get told exactly how many skills were found — then sent straight back to a feed that has re-ranked itself around you." },
  { n: "03", t: "Apply where it's real", d: "Every card links out to the company's own careers page. Umbrix never sits between you and the employer, never forwards your CV, and never sells your details to a consultancy." },
];

const SIGNALS = [
  { name: "Skill overlap", meta: "Aliases folded", pct: 92, d: "JS ↔ JavaScript, Node ↔ Node.js, K8s ↔ Kubernetes. Writing it the other way doesn't cost you the match." },
  { name: "Discipline alignment", meta: "All 16 fields", pct: 78, d: "Mechanical, electrical, civil and the trades are read as separate disciplines — not lumped into one “manufacturing” bucket." },
  { name: "Seniority & fresher fit", meta: "Scaled penalty", pct: 85, d: "An entry role reads as a fit, never “below your level”. A 10-year requirement ranks far below a 3-year one." },
  { name: "Eligibility, read from the JD", meta: "Batch · branch · CGPA", pct: 70, d: "Where a regex can't tell, a daily job reads the description itself to fill in minimum experience, batch year, branch and CGPA." },
];

const PATTERNS: [string, "Heavy" | "Medium"][] = [
  ["Pay-to-apply / registration fee", "Heavy"],
  ["Refundable “security deposit”", "Heavy"],
  ["Training-kit charges", "Heavy"],
  ["UPI payment request", "Heavy"],
  ["Apply via WhatsApp / Telegram", "Medium"],
  ["Personal Gmail as the contact", "Medium"],
];

const ROWS = [
  ["Associate Software Engineer", "Groww", "Bengaluru", "0–1 yrs", "94"],
  ["Business Analyst — Growth", "Meesho", "Bengaluru", "Fresher", "88"],
  ["Graduate Engineer Trainee", "Freshworks", "Chennai", "2026 batch", "83"],
  ["Customer Success Associate", "PhonePe", "Pune", "0–2 yrs", "76"],
  ["Design Intern — Product", "CRED", "Bengaluru", "Internship", "71"],
  ["Mechanical Design Engineer", "InMobi", "Hyderabad", "0–2 yrs", "64"],
];

const SURFACES = [
  { route: "/feed", t: "Discovery feed", d: "India by default, scoped to your fields, split into Strong / Good / Explore. Filter by city, category, fresher-eligible or India-only. Browsable without signing in." },
  { route: "/tracker", t: "Application tracker", d: "Saved → Applied → Interview → Rejected, drag and drop, notes on every card. The spreadsheet you were going to stop updating in week two." },
  { route: "/scam-check", t: "Scam Check", d: "Found a posting somewhere else? Paste it in and run it through the same filter, free, without an account. It tells you which patterns it hit." },
  { route: "/profile", t: "Résumé tailoring", d: "A per-job, ATS-safe .docx built only from what's already true on your CV. Three a month on the free tier — no invented experience, ever." },
];

const FREE = [
  "The whole discovery feed, scam-filtered",
  "Match scores and the full “why” report",
  "Résumé parsing and an editable profile",
  "Application tracker, capped active slots",
  "Three tailored résumés a month",
  "Scam Check, no account required",
];

const PREMIUM = [
  "Unlimited tracker slots and follow-up reminders",
  "Eligibility filtering: batch, branch, CGPA",
  "Email digest of new matches",
  "Unlimited résumé tailoring and cover letters",
  "Multiple résumés, one per target field",
];

const FAQ = [
  ["Do I have to pay anything to apply?", "No — and if a posting on Umbrix ever asks you to, that's the exact pattern the filter exists to catch. Report it and we'll audit why it got through."],
  ["Where do the jobs come from?", "Public ATS APIs — Greenhouse, Lever, Ashby and SmartRecruiters — plus the Adzuna aggregator across 18 India shards. APIs only, no scraping, and stale listings are reconciled to Closed automatically."],
  ["What happens to my résumé?", "It's parsed into structured skills, education and target fields so the feed can rank for you. It is never forwarded to an employer or a consultancy — you apply yourself, on their site."],
  ["I'm not in tech. Is this for me?", "Yes. Sixteen fields — engineering, sales, finance, healthcare, teaching, logistics, retail, hospitality and more — each with its own scoring, not a software model bolted onto everything."],
  ["Why is Google the only way to sign in?", "Fewer accounts to breach, no passwords to store, and a much higher bar for bulk fake signups. Phone OTP is a post-launch experiment, gated on what the funnel actually shows."],
];

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
  ["Chandigarh", "chandigarh"], ["Coimbatore", "coimbatore"], ["Indore", "indore"],
];

/* ── page ───────────────────────────────────────────────────────────────── */

export default function UmbrixLanding({ onSignIn }: { onSignIn?: () => void }) {
  useReveal();
  const [menu, setMenu] = useState(false);
  const signIn = () => (onSignIn ? onSignIn() : undefined);

  return (
    <div className="um-page" id="top">

      {/* HEADER */}
      <header className="um-header">
        <div className="um-wrap um-header__bar">
          <Link href="/" className="um-brand" aria-label="Umbrix — home">
            <Image src="/umbrix-emblem.png" alt="" width={619} height={586} priority />
            <span>UMBRIX</span>
          </Link>
          <nav className="um-nav">
            {NAV.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <div className="um-auth">
            <button type="button" className="um-btn um-btn--secondary" onClick={signIn}>Log in</button>
            <button type="button" className="um-btn um-btn--primary" onClick={signIn}>Continue with Google</button>
          </div>
          <button type="button" className="um-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menu && (
          <div className="um-sheet">
            {NAV.map((l) => <a key={l.href} href={l.href} onClick={() => setMenu(false)}>{l.label}</a>)}
            <button type="button" className="um-btn um-btn--primary um-btn--block" style={{ marginTop: 16 }} onClick={() => { setMenu(false); signIn(); }}>
              Continue with Google
            </button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="um-hero">
        <div className="um-wrap um-hero__inner">
          <div className="um-eyebrow" data-reveal="0" style={{ marginBottom: "clamp(20px,3vw,28px)" }}>
            <i /><span>Follow Your North Star.</span>
          </div>

          <h1 className="um-h1" data-reveal="60">
            <span style={{ color: "var(--um-n600)" }}>Stop hunting.</span><br />
            <span style={{ color: "var(--um-accent)" }}>Start finding.</span>
          </h1>

          <p className="um-lede" data-reveal="120" style={{ marginBottom: "clamp(24px,3vw,32px)" }}>
            Search verified jobs from official company career pages — all in one place.
          </p>

          <div data-reveal="180" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <button type="button" className="um-btn um-btn--primary" style={{ fontSize: 15 }} onClick={signIn}>
              Continue with Google <ArrowRight size={16} />
            </button>
            <Link href="/feed" className="um-btn um-btn--secondary" style={{ fontSize: 15 }}>Browse 6,700 India roles</Link>
          </div>
          <p className="um-fine" data-reveal="200" style={{ marginBottom: "clamp(24px,3vw,32px)" }}>
            No card. No recruiter calls. No “registration fee”.
          </p>

          <div className="um-hero__ticks" data-reveal="240">
            {TICKS.map((t) => (
              <div className="um-tick" key={t}>
                <Check size={16} strokeWidth={2.6} color="var(--um-accent)" /><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STAT BAND */}
      <section className="um-section">
        <div className="um-wrap">
          <div className="um-stats">
            {STATS.map((s, i) => (
              <div className="um-stat" key={s.label} data-reveal={i * 80}>
                <div className="um-stat__n" style={i === 3 ? { color: "var(--um-accent)" } : undefined}>
                  <span data-count={s.n} {...(s.comma ? { "data-comma": "1" } : {})}>{s.display}</span>
                </div>
                <div className="um-stat__l">{s.label}</div>
                <div className="um-stat__s">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOURCE TICKER */}
      <div className="um-ticker">
        <div className="um-ticker__track">
          {[0, 1].map((copy) => (
            <div className="um-ticker__run" key={copy} aria-hidden={copy === 1}>
              {SOURCES.map((s) => (<span key={s}>{s}<em style={{ marginLeft: 40 }}>/</em></span>))}
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="um-section" id="how">
        <div className="um-wrap um-pad">
          <div data-reveal="0" style={{ display: "flex", flexWrap: "wrap", gap: "16px 48px", alignItems: "flex-end", marginBottom: "clamp(36px,5vw,56px)" }}>
            <h2 className="um-h2" style={{ maxWidth: "14ch" }}>Three steps. Then you&apos;re applying.</h2>
            <p className="um-muted" style={{ fontSize: 15, maxWidth: "38ch", margin: 0 }}>
              There is no onboarding quiz, no “premium profile”, no sales call. The whole thing takes about thirty seconds.
            </p>
          </div>
          <div className="um-steps">
            {STEPS.map((s, i) => (
              <div className="um-step" key={s.n} data-reveal={i * 90}>
                <div className="um-kicker" style={{ letterSpacing: "0.1em", marginBottom: 14 }}>{s.n}</div>
                <h3 style={{ fontSize: "clamp(20px,2.4vw,26px)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{s.t}</h3>
                <p className="um-muted" style={{ fontSize: 14, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MATCH SCORE */}
      <section className="um-section um-section--surface" id="match">
        <div className="um-wrap um-pad um-split">
          <div style={{ flex: "1 1 340px", minWidth: 0 }} data-reveal="0">
            <div className="um-kicker" style={{ marginBottom: 16 }}>The match score</div>
            <h2 className="um-h2" style={{ maxWidth: "15ch", marginBottom: 20 }}>A number you can argue with.</h2>
            <p className="um-muted" style={{ fontSize: 15, maxWidth: "46ch" }}>
              Most boards say “recommended for you” and leave it there. Umbrix gives every job a score out of 99 and shows its working — which skills matched, which discipline it read you as, and the one thing you&apos;d need to add.
            </p>
            <p className="um-muted" style={{ fontSize: 15, maxWidth: "46ch", marginBottom: 24 }}>
              Scores group the feed into <strong>Strong</strong>, <strong>Good</strong> and <strong>Explore</strong>, so a bad week never looks like an empty page.
            </p>
            <Link href="/feed" className="um-btn um-btn--primary" style={{ padding: "13px 20px" }}>See your matches <ArrowRight size={15} /></Link>
          </div>

          <div style={{ flex: "1.05 1 380px", minWidth: 0 }} data-reveal="120">
            {SIGNALS.map((s) => (
              <div className="um-signal" key={s.name}>
                <div className="um-signal__head">
                  <span className="um-signal__name">{s.name}</span>
                  <span className="um-signal__meta">{s.meta}</span>
                </div>
                <div className="um-bar"><i style={{ width: `${s.pct}%` }} /></div>
                <p className="um-muted" style={{ fontSize: 13, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCAM FILTER */}
      <section className="um-section" id="scam">
        <div className="um-wrap um-pad">
          <div className="um-split" data-reveal="0">
            <div style={{ flex: "1 1 380px", minWidth: 0 }}>
              <div className="um-kicker" style={{ marginBottom: 16 }}>The scam filter</div>
              <h2 className="um-h2" style={{ maxWidth: "15ch", marginBottom: 20 }}>No single word can kill a job.</h2>
              <p className="um-muted" style={{ fontSize: 15, maxWidth: "48ch" }}>
                Every posting is scored against weighted heuristics tuned for the scams that target Indian freshers. A listing is only blocked once the weighted score crosses a threshold — so a fintech JD that mentions “wire transfer” survives, and a reputable JD that promises it will <em>never</em> ask you for a fee is not flagged by its own disclaimer.
              </p>
              <p className="um-muted" style={{ fontSize: 15, maxWidth: "48ch", marginBottom: 24 }}>
                Every block is auditable: the filter returns the exact reasons, and a test suite runs before each ingest so it can&apos;t quietly regress.
              </p>
              <Link href="/scam-check" className="um-btn um-btn--secondary" style={{ padding: "13px 20px" }}>
                Paste a posting into Scam Check <ArrowRight size={15} />
              </Link>
            </div>

            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ border: "2px solid var(--um-text)", background: "var(--um-bg)" }}>
                <div style={{ padding: "12px 18px", borderBottom: "2px solid var(--um-text)", fontFamily: "var(--um-heading)", fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  What gets weighed
                </div>
                <div style={{ padding: "6px 18px 18px" }}>
                  {PATTERNS.map(([label, weight], i) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: i === PATTERNS.length - 1 ? "none" : "1px solid var(--um-divider)", fontSize: 14 }}>
                      <span>{label}</span>
                      <span className={weight === "Heavy" ? "um-tag um-tag--accent" : "um-tag um-tag--neutral"}>{weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE FEED */}
      <section className="um-section um-section--surface" id="feed">
        <div className="um-wrap um-pad">
          <div data-reveal="0" style={{ display: "flex", flexWrap: "wrap", gap: "16px 40px", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "clamp(28px,4vw,44px)" }}>
            <div>
              <div className="um-kicker" style={{ marginBottom: 14 }}>In the feed right now</div>
              <h2 className="um-h2" style={{ fontSize: "clamp(28px,4.2vw,48px)", maxWidth: "18ch" }}>Fresher-eligible, scam-checked, scored.</h2>
            </div>
            <div className="um-eyebrow" style={{ fontSize: 12, letterSpacing: 0, textTransform: "none", fontWeight: 400, color: "var(--um-n700)" }}>
              <i />Aggregators refresh 00:00 UTC · ATS boards 04:00 UTC
            </div>
          </div>

          <div className="um-tablewrap" data-reveal="80">
            <table className="um-table">
              <thead>
                <tr><th>Role</th><th>Company</th><th>Location</th><th>Eligibility</th><th style={{ textAlign: "right" }}>Match</th></tr>
              </thead>
              <tbody>
                {ROWS.map(([role, co, city, elig, score]) => (
                  <tr key={role}>
                    <td style={{ fontWeight: 600 }}>{role}</td>
                    <td>{co}</td>
                    <td>{city}</td>
                    <td><span className={elig.includes("yrs") && elig !== "0–1 yrs" ? "um-tag um-tag--neutral" : "um-tag um-tag--accent"}>{elig}</span></td>
                    <td style={{ textAlign: "right", fontFamily: "var(--um-heading)", fontWeight: 800 }}>{score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="um-fine" data-reveal="120" style={{ margin: "14px 0 0" }}>
            Illustrative rows. Scores are personal — yours change the moment your résumé is read.
          </p>
        </div>
      </section>

      {/* SURFACES */}
      <section className="um-section">
        <div className="um-wrap um-pad">
          <h2 className="um-h2" data-reveal="0" style={{ maxWidth: "20ch", marginBottom: "clamp(32px,4vw,52px)" }}>Four surfaces. One job search.</h2>
          <div className="um-surfaces">
            {SURFACES.map((s, i) => (
              <div className="um-surface" key={s.route} data-reveal={i * 70}>
                <div className="um-kicker" style={{ fontSize: 10, marginBottom: 14 }}>{s.route}</div>
                <h3 style={{ fontSize: 21, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{s.t}</h3>
                <p className="um-muted" style={{ fontSize: 13.5, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT'S FREE */}
      <section className="um-section um-section--surface" id="free">
        <div className="um-wrap um-pad">
          <div data-reveal="0" style={{ display: "flex", flexWrap: "wrap", gap: "16px 48px", alignItems: "flex-end", marginBottom: "clamp(32px,4vw,52px)" }}>
            <h2 className="um-h2" style={{ maxWidth: "16ch" }}>The feed is free. That isn&apos;t a trial.</h2>
            <p className="um-muted" style={{ fontSize: 15, maxWidth: "36ch", margin: 0 }}>
              We don&apos;t take money from employers, so nothing in the ranking is bought. There&apos;s no checkout yet at all — premium arrives when the free limits actually start hurting people.
            </p>
          </div>

          <div className="um-plans">
            <div className="um-plan" data-reveal="0">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <h3 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>Free</h3>
                <span style={{ fontFamily: "var(--um-heading)", fontWeight: 800, fontSize: 32, letterSpacing: "-0.03em" }}>₹0</span>
              </div>
              <p className="um-fine" style={{ marginBottom: 20 }}>Everything a job search actually needs.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 14 }}>
                {FREE.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 9 }}>
                    <Check size={16} strokeWidth={2.6} color="var(--um-accent)" style={{ flex: "none", marginTop: 3 }} /><span>{f}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="um-btn um-btn--primary um-btn--block" style={{ marginTop: 24 }} onClick={signIn}>Continue with Google</button>
            </div>

            <div className="um-plan" data-reveal="90">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <h3 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>Premium</h3>
                <span className="um-tag um-tag--outline">Not shipped</span>
              </div>
              <p className="um-fine" style={{ marginBottom: 20 }}>Defined, scaffolded, deliberately unpriced.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 14, color: "var(--um-n800)" }}>
                {PREMIUM.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 9 }}>
                    <span style={{ width: 16, flex: "none", textAlign: "center", color: "var(--um-n500)" }}>—</span><span>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--um-divider)", fontSize: 13, color: "var(--um-n700)" }}>
                No payment provider is wired up. We&apos;re holding monetisation until the numbers show people hitting the free limits — and the feed will never be behind it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="um-section">
        <div className="um-wrap um-pad um-split">
          <h2 className="um-h2" data-reveal="0" style={{ flex: "0 1 300px", fontSize: "clamp(28px,4.2vw,48px)" }}>Fair questions.</h2>
          <div style={{ flex: "1.4 1 400px", minWidth: 0, borderTop: "2px solid var(--um-text)" }}>
            {FAQ.map(([q, a], i) => (
              <div key={q} data-reveal={i * 60} style={{ padding: "22px 0", borderBottom: "1px solid var(--um-divider)" }}>
                <h4 style={{ fontSize: 17, margin: "0 0 8px" }}>{q}</h4>
                <p className="um-muted" style={{ fontSize: 14, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="um-section um-section--invert" id="cta">
        <div className="um-wrap" style={{ padding: "clamp(64px,9vw,132px) clamp(16px,4vw,40px)" }}>
          <div className="um-eyebrow" data-reveal="0" style={{ letterSpacing: "0.14em", marginBottom: "clamp(20px,3vw,32px)", opacity: 0.85 }}>
            umbrix.in — free for students and freshers
          </div>
          <h2 data-reveal="60" style={{ fontSize: "clamp(42px,9vw,124px)", lineHeight: 0.92, letterSpacing: "-0.045em", margin: "0 0 clamp(24px,3vw,36px)", color: "var(--um-bg)" }}>
            Search less.<br />Apply direct.
          </h2>
          <p data-reveal="120" style={{ fontSize: "clamp(15px,1.8vw,20px)", maxWidth: "48ch", margin: "0 0 clamp(28px,4vw,40px)", color: "var(--um-bg)", opacity: 0.9 }}>
            Sign in with Google, drop a PDF, and see what genuinely matches you. About thirty seconds, and nobody calls you afterwards.
          </p>
          <div data-reveal="160" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button type="button" className="um-btn um-btn--onDark" style={{ padding: "16px 26px", fontSize: 16 }} onClick={signIn}>
              Continue with Google <ArrowRight size={17} />
            </button>
            <Link href="/feed" className="um-btn um-btn--ghostDark" style={{ padding: "16px 26px", fontSize: 16 }}>Look around first</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="um-footer">
        <div className="um-wrap" style={{ padding: "clamp(44px,6vw,72px) clamp(16px,4vw,40px)" }}>
          <div className="um-foot-cols">
            <div style={{ minWidth: 0 }}>
              <Image src="/umbrix-emblem.png" alt="Umbrix" width={619} height={586} style={{ width: "auto", height: 60, marginBottom: 16 }} />
              <div style={{ fontFamily: "var(--um-logo)", fontWeight: 300, fontSize: 24, letterSpacing: "0.26em", textIndent: "0.26em", lineHeight: 1, marginBottom: 10 }}>UMBRIX</div>
              <div style={{ fontFamily: "var(--um-logo)", fontWeight: 400, fontSize: 9, letterSpacing: "0.28em", textIndent: "0.28em", color: "var(--um-n700)", marginBottom: 16 }}>FOLLOW YOUR NORTH STAR.</div>
              <p className="um-muted" style={{ fontSize: 13, maxWidth: "34ch" }}>Real, scam-checked, fresher-eligible jobs across every field. Built in India.</p>
              <a href="https://www.umbrix.in" style={{ fontSize: 13 }}>www.umbrix.in</a>
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="um-collabel">Jobs by field</div>
              <div className="um-linkgrid">
                {FIELDS.map(([label, slug]) => <Link key={slug} href={`/jobs/${slug}`}>{label}</Link>)}
              </div>
              <div className="um-collabel" style={{ marginTop: 28 }}>Jobs by city</div>
              <div className="um-linkgrid">
                {CITIES.map(([label, slug]) => <Link key={slug} href={`/jobs/it/${slug}`}>{label}</Link>)}
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

          <div style={{ borderTop: "2px solid var(--um-divider)", paddingTop: 20, display: "flex", flexWrap: "wrap", gap: "12px 32px", justifyContent: "space-between", fontSize: 12, color: "var(--um-n700)" }}>
            <span>© {new Date().getFullYear()} Umbrix. Jobs sourced from public ATS APIs. We never charge you to apply.</span>
            <span>Feed refreshed daily · 00:00 &amp; 04:00 UTC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
