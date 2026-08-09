/**
 * Adapts the existing `UserProfile` into a Career Evidence Graph.
 *
 * The profile the app already stores — skills, experience, education, summary —
 * is a flat shape from an earlier design. Rather than migrate
 * it or ask candidates to re-enter everything, this projects what exists into
 * the graph so the editor works on real data from day one, and the graph can be
 * persisted separately later without a breaking change.
 *
 * Provenance is set honestly: anything projected from a résumé parse is marked
 * `llm` with reduced confidence, so the editor can show "needs verification"
 * rather than presenting an extraction as though the candidate typed it.
 */

import type { CareerProfile, EvidenceItem } from "./types";
import { detectAll } from "./detector";
import { reconstructBullets } from "./reconstruct";

export interface StoredProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  title?: string;
  skills?: string[];
  experience?: { role?: string; company?: string; duration?: string; description?: string }[];
  education?: string[];
  targetFields?: string[];
  resumeText?: string;
  /** True when the fields came from an upload rather than being typed. */
  fromResume?: boolean;
}

/** Split a stored "duration" like "Jun 2024 – Present" into its ends. */
function splitDuration(duration?: string): { startDate?: string; endDate?: string; current?: boolean } {
  if (!duration) return {};
  const [start, end] = duration.split(/\s*[–—-]\s*/);
  const current = /present|current|ongoing/i.test(end ?? "");
  return { startDate: start?.trim() || undefined, endDate: current ? undefined : end?.trim() || undefined, current };
}

/**
 * Whether an entry is really a project rather than employment.
 *
 * The stored shape has one list for both, and parsers routinely file a personal
 * project under "experience" with the company set to something like "Personal
 * Project". Classifying it correctly matters: a fresher's document leads with
 * projects, and mislabelling one as employment produces a résumé that overstates
 * their history.
 */
function classifyItem(company?: string): "experience" | "project" {
  return /personal|self|own|side|academic|college|university|project|hobby/i.test(company ?? "")
    ? "project"
    : "experience";
}

/** Links found in résumé text. Labelled by host so they render sensibly. */
function extractLinks(text?: string): { label: string; url: string }[] {
  if (!text) return [];
  const found = new Map<string, string>();
  const re = /(https?:\/\/[^\s,;)]+|(?:www\.|github\.com\/|linkedin\.com\/in\/)[^\s,;)]+)/gi;
  for (const match of text.matchAll(re)) {
    const raw = match[0].replace(/[.,)]+$/, "");
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    const label = /github/i.test(url)
      ? "GitHub"
      : /linkedin/i.test(url)
        ? "LinkedIn"
        : "Portfolio";
    if (!found.has(label)) found.set(label, url);
  }
  return [...found].map(([label, url]) => ({ label, url }));
}

/**
 * Project the stored profile into a career graph.
 *
 * @param stored - The `UserProfile` document as the API returns it.
 */
export function toCareerProfile(stored: StoredProfile): CareerProfile {
  // Anything derived from an upload is an extraction, not a statement.
  const source = stored.fromResume ? "llm" : "user";
  const confidence = stored.fromResume ? 0.65 : 1;

  const items: EvidenceItem[] = [];

  for (const [index, entry] of (stored.experience ?? []).entries()) {
    const kind = classifyItem(entry.company);
    // A stored description may itself be several wrapped lines.
    const bulletTexts = entry.description ? reconstructBullets(entry.description) : [];
    items.push({
      id: `exp-${index}`,
      kind,
      title: entry.role?.trim() || "Untitled",
      organization: entry.company?.trim() || undefined,
      ...splitDuration(entry.duration),
      bullets: detectAll(bulletTexts.length > 0 ? bulletTexts : entry.description ? [entry.description] : []),
      skills: [],
      source,
      confidence,
    });
  }

  for (const [index, line] of (stored.education ?? []).entries()) {
    items.push({
      id: `edu-${index}`,
      kind: "education",
      title: String(line).trim(),
      bullets: [],
      skills: [],
      source,
      confidence,
    });
  }

  // Skills demonstrated in bullets are attached back to their item, so the
  // editor can show which evidence supports which skill.
  for (const item of items) {
    item.skills = [...new Set(item.bullets.flatMap((b) => b.technologies))];
  }

  return {
    identity: {
      name: stored.name,
      email: stored.email,
      phone: stored.phone,
      location: stored.location,
      headline: stored.title,
      summary: stored.summary,
      links: extractLinks(stored.resumeText),
    },
    items,
    declaredSkills: stored.skills ?? [],
    targetFields: stored.targetFields ?? [],
  };
}
