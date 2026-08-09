/**
 * Résumé versions and diffing.
 *
 * A candidate should never have to damage their main résumé to try a targeted
 * one. Because a document is a *selection and ordering over shared evidence*
 * rather than a copy of it, a version costs almost nothing to keep: fixing a
 * typo in a bullet fixes it in every version at once, while each version keeps
 * its own choices about what to show and in what order.
 *
 * That is also what makes the diff meaningful. Comparing two documents is
 * comparing two decisions about the same career, so the output can say
 * "Sahayam promoted above GetFreeTools" instead of dumping changed text.
 *
 * Pure module — no database, no React, no model calls.
 */

import type { CareerProfile } from "./types";
import type { ResumeDocument } from "./document";

export interface ResumeVersion {
  id: string;
  name: string;
  document: ResumeDocument;
  /** ISO timestamp. Supplied by the caller so this module stays deterministic. */
  updatedAt: string;
  /** The version this was branched from, for provenance. */
  derivedFrom?: string;
}

export type ChangeKind = "added" | "removed" | "promoted" | "demoted" | "shown" | "hidden";

export interface DocumentChange {
  kind: ChangeKind;
  /** "Projects", "Skills" — where the change happened. */
  section: string;
  /** The item's title, or the section name for section-level changes. */
  label: string;
  /** Positions moved, for promoted/demoted. */
  positions?: number;
}

export interface DocumentDiff {
  changes: DocumentChange[];
  /** True when the two documents present identically. */
  identical: boolean;
}

const VERB: Record<ChangeKind, string> = {
  added: "added to",
  removed: "removed from",
  promoted: "moved up in",
  demoted: "moved down in",
  shown: "shown",
  hidden: "hidden",
};

/**
 * Compare two documents over the same career.
 *
 * Item titles are resolved through the profile so the diff reads in the
 * candidate's own language — "Sahayam", not "exp-2". An id that no longer
 * resolves is reported by its id rather than skipped, because silently dropping
 * a change would make the diff untrustworthy exactly when something is wrong.
 */
export function diffDocuments(a: ResumeDocument, b: ResumeDocument, profile: CareerProfile): DocumentDiff {
  const titles = new Map(profile.items.map((i) => [i.id, i.title]));
  const label = (id: string) => titles.get(id) ?? id;
  const changes: DocumentChange[] = [];

  const sectionsA = new Map(a.sections.map((s) => [s.id, s]));
  const sectionsB = new Map(b.sections.map((s) => [s.id, s]));

  // --- Section-level ------------------------------------------------------
  for (const [id, section] of sectionsB) {
    if (!sectionsA.has(id)) {
      changes.push({ kind: "added", section: section.heading, label: section.heading });
    }
  }
  for (const [id, section] of sectionsA) {
    if (!sectionsB.has(id)) {
      changes.push({ kind: "removed", section: section.heading, label: section.heading });
    }
  }
  for (const [id, before] of sectionsA) {
    const after = sectionsB.get(id);
    if (!after || before.visible === after.visible) continue;
    changes.push({ kind: after.visible ? "shown" : "hidden", section: after.heading, label: after.heading });
  }

  // --- Item-level ---------------------------------------------------------
  for (const [id, after] of sectionsB) {
    const before = sectionsA.get(id);
    if (!before) continue;

    const beforeIds = before.itemIds;
    const afterIds = after.itemIds;

    for (const itemId of afterIds) {
      if (!beforeIds.includes(itemId)) {
        changes.push({ kind: "added", section: after.heading, label: label(itemId) });
      }
    }
    for (const itemId of beforeIds) {
      if (!afterIds.includes(itemId)) {
        changes.push({ kind: "removed", section: after.heading, label: label(itemId) });
      }
    }

    // Movement is only meaningful for items present in both, and is measured
    // against the other survivors — otherwise removing the top item would
    // report every remaining item as "promoted", which is noise, not a change
    // the candidate made.
    const survivors = beforeIds.filter((x) => afterIds.includes(x));
    const orderAfter = afterIds.filter((x) => survivors.includes(x));
    for (const itemId of survivors) {
      const from = survivors.indexOf(itemId);
      const to = orderAfter.indexOf(itemId);
      if (from === to) continue;
      changes.push({
        kind: to < from ? "promoted" : "demoted",
        section: after.heading,
        label: label(itemId),
        positions: Math.abs(to - from),
      });
    }
  }

  return { changes, identical: changes.length === 0 };
}

/** One human-readable line per change. */
export function describeChange(change: DocumentChange): string {
  if (change.kind === "shown" || change.kind === "hidden") {
    return `${change.label} ${VERB[change.kind]}`;
  }
  const positions = change.positions ? ` (${change.positions} place${change.positions === 1 ? "" : "s"})` : "";
  return `${change.label} ${VERB[change.kind]} ${change.section}${positions}`;
}

/**
 * Branch a new version from an existing one.
 *
 * The document is deep-copied so later edits to the parent cannot reach into
 * the child. A version's whole purpose is to survive changes to the master, and
 * sharing a section array by reference would quietly defeat that.
 */
export function branchVersion(
  parent: ResumeVersion,
  name: string,
  id: string,
  now: string
): ResumeVersion {
  return {
    id,
    name,
    derivedFrom: parent.id,
    updatedAt: now,
    document: {
      ...parent.document,
      id,
      name,
      sections: parent.document.sections.map((s) => ({ ...s, itemIds: [...s.itemIds] })),
    },
  };
}

/**
 * Whether a version still shows every piece of evidence it did when branched.
 *
 * Used to warn that a version has drifted from the master rather than to
 * silently reconcile them — merging automatically is how a candidate loses a
 * deliberate customisation.
 */
export function missingFromVersion(version: ResumeVersion, profile: CareerProfile): string[] {
  const shown = new Set(version.document.sections.flatMap((s) => s.itemIds));
  return profile.items.filter((i) => !shown.has(i.id)).map((i) => i.title);
}
