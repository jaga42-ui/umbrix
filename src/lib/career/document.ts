/**
 * The résumé document model.
 *
 * A document does not *contain* a candidate's career — it references it. Every
 * section holds ids pointing into the Career Evidence Graph, so the same
 * evidence can appear in a frontend résumé and a data résumé without being
 * duplicated, and correcting a typo once fixes it everywhere.
 *
 * That indirection is what makes versioning tractable later: a "Frontend
 * Resume" is a selection and an ordering over shared evidence, not a second
 * copy that silently drifts from the first.
 *
 * Pure module — no React, no database, no model calls. Every operation returns
 * a new document rather than mutating, so the editor can undo by keeping the
 * previous value and the whole model is trivially testable.
 */

import type { CareerProfile, EvidenceItem, EvidenceKind } from "./types";

export type SectionKind = "summary" | "skills" | EvidenceKind;

export interface ResumeSection {
  id: string;
  kind: SectionKind;
  /** The printed heading. Editable — "Projects" vs "Selected Work". */
  heading: string;
  /** Hidden sections stay in the document so hiding is reversible. */
  visible: boolean;
  /** Ids into CareerProfile.items. Ignored by summary/skills sections. */
  itemIds: string[];
}

export interface ResumeDocument {
  id: string;
  /** What the candidate calls this version — "Master", "Frontend". */
  name: string;
  templateId: string;
  sections: ResumeSection[];
}

/**
 * Section order for a résumé.
 *
 * Contact first, then a summary, then the evidence. Experience precedes
 * projects for anyone with real work history; `buildDocument` flips that for a
 * fresher, because a student's projects are their strongest evidence and burying
 * them under an empty experience heading is the most common fresher mistake.
 */
const DEFAULT_ORDER: SectionKind[] = [
  "summary",
  "experience",
  "project",
  "education",
  "skills",
  "certification",
  "achievement",
  "leadership",
  "volunteering",
  "competition",
  "publication",
];

const HEADINGS: Record<SectionKind, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  project: "Projects",
  education: "Education",
  certification: "Certifications",
  achievement: "Achievements",
  leadership: "Leadership",
  volunteering: "Volunteering",
  competition: "Competitions",
  publication: "Publications",
};

/** A candidate with no real work history leads with projects. */
export function isFresher(profile: CareerProfile): boolean {
  return !profile.items.some((i) => i.kind === "experience");
}

/**
 * Build the starting document for a profile.
 *
 * Only sections with content are created. An empty "Experience" heading on a
 * fresher's résumé advertises the gap rather than the evidence, so it is not
 * emitted at all — the candidate can add it deliberately if they want it.
 */
export function buildDocument(profile: CareerProfile, name = "Master"): ResumeDocument {
  const byKind = new Map<EvidenceKind, string[]>();
  for (const item of profile.items) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item.id);
    byKind.set(item.kind, list);
  }

  const order = isFresher(profile)
    ? DEFAULT_ORDER.filter((k) => k !== "experience")
    : DEFAULT_ORDER;

  const sections: ResumeSection[] = [];
  for (const kind of order) {
    if (kind === "summary") {
      if (profile.identity.summary || profile.identity.headline) {
        sections.push({ id: "summary", kind, heading: HEADINGS[kind], visible: true, itemIds: [] });
      }
      continue;
    }
    if (kind === "skills") {
      if (profile.declaredSkills.length > 0) {
        sections.push({ id: "skills", kind, heading: HEADINGS[kind], visible: true, itemIds: [] });
      }
      continue;
    }
    const ids = byKind.get(kind) ?? [];
    if (ids.length > 0) {
      sections.push({ id: kind, kind, heading: HEADINGS[kind], visible: true, itemIds: ids });
    }
  }

  return { id: "doc", name, templateId: "classic", sections };
}

/** Move a section, clamped to the ends. Returns a new document. */
export function moveSection(doc: ResumeDocument, sectionId: string, delta: number): ResumeDocument {
  const index = doc.sections.findIndex((s) => s.id === sectionId);
  if (index === -1) return doc;
  const target = Math.max(0, Math.min(doc.sections.length - 1, index + delta));
  if (target === index) return doc;

  const sections = [...doc.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(target, 0, moved);
  return { ...doc, sections };
}

/** Move one item within its section. Returns a new document. */
export function moveItem(doc: ResumeDocument, sectionId: string, itemId: string, delta: number): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const index = section.itemIds.indexOf(itemId);
      if (index === -1) return section;
      const target = Math.max(0, Math.min(section.itemIds.length - 1, index + delta));
      if (target === index) return section;
      const itemIds = [...section.itemIds];
      const [moved] = itemIds.splice(index, 1);
      itemIds.splice(target, 0, moved);
      return { ...section, itemIds };
    }),
  };
}

/** Show or hide a section without discarding it. */
export function toggleSection(doc: ResumeDocument, sectionId: string): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s)),
  };
}

/** Drop one item from a section. The evidence itself is untouched. */
export function removeItem(doc: ResumeDocument, sectionId: string, itemId: string): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId ? { ...s, itemIds: s.itemIds.filter((id) => id !== itemId) } : s
    ),
  };
}

/** Add an item back to a section, at the end, without duplicating it. */
export function addItem(doc: ResumeDocument, sectionId: string, itemId: string): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id === sectionId && !s.itemIds.includes(itemId) ? { ...s, itemIds: [...s.itemIds, itemId] } : s
    ),
  };
}

/** Resolve a document against a profile: visible sections with real items. */
export function resolveDocument(
  doc: ResumeDocument,
  profile: CareerProfile
): { section: ResumeSection; items: EvidenceItem[] }[] {
  const byId = new Map(profile.items.map((i) => [i.id, i]));
  return doc.sections
    .filter((s) => s.visible)
    .map((section) => ({
      section,
      // Order follows itemIds, not profile order — the document owns sequence.
      items: section.itemIds.map((id) => byId.get(id)).filter((i): i is EvidenceItem => Boolean(i)),
    }))
    // A section whose items were all removed would print as a bare heading.
    .filter(({ section, items }) => items.length > 0 || section.kind === "summary" || section.kind === "skills");
}

/** Evidence in the graph that this document does not currently show. */
export function unusedItems(doc: ResumeDocument, profile: CareerProfile): EvidenceItem[] {
  const used = new Set(doc.sections.flatMap((s) => s.itemIds));
  return profile.items.filter((i) => !used.has(i.id));
}

/**
 * A rough page estimate.
 *
 * Deliberately approximate and labelled as such in the UI. A real layout engine
 * needs the rendered document; this exists so the editor can warn "you are
 * probably onto a second page" while typing, which is the moment the warning is
 * useful. It never reformats anything on the candidate's behalf.
 */
export function estimateLines(doc: ResumeDocument, profile: CareerProfile): number {
  const resolved = resolveDocument(doc, profile);
  let lines = 4; // contact block
  for (const { section, items } of resolved) {
    lines += 2; // heading + spacing
    if (section.kind === "summary") {
      lines += Math.ceil((profile.identity.summary?.length ?? 0) / 110);
      continue;
    }
    if (section.kind === "skills") {
      lines += Math.ceil(profile.declaredSkills.join(", ").length / 110);
      continue;
    }
    for (const item of items) {
      lines += 1; // title line
      for (const bullet of item.bullets) lines += Math.ceil(bullet.text.length / 110);
    }
  }
  return lines;
}

/** Lines that fit on one A4 page at typical résumé typography. */
export const LINES_PER_PAGE = 46;
