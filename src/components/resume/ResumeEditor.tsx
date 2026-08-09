"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Eye, EyeOff, Plus, X, AlertCircle, FileText } from "lucide-react";
import type { CareerProfile, EvidenceItem } from "@/lib/career/types";
import { VERIFY_BELOW, EVIDENCE_STRENGTH_LABEL } from "@/lib/career/types";
import {
  buildDocument, moveSection, moveItem, toggleSection, removeItem, addItem,
  resolveDocument, unusedItems, estimateLines, LINES_PER_PAGE, type ResumeDocument,
} from "@/lib/career/document";
import { xray } from "@/lib/career/xray";

/**
 * The structured résumé editor.
 *
 * Three panes: the evidence you have, the document you are assembling, and what
 * the document currently proves. Not a canvas editor — the spec is explicit that
 * this is not a Canva clone, and free-form positioning is exactly what makes a
 * résumé unparseable by an ATS. The candidate controls selection, ordering and
 * wording; the typography is fixed by the template, deliberately.
 *
 * Intelligence is contextual rather than a chatbot: the evidence level sits on
 * the bullet it describes, and the weakest dimension is named where you are
 * working. Nothing here writes text on the candidate's behalf.
 *
 * All state is local and derived. Every document operation returns a new value,
 * so the editor never mutates and re-analysis is a pure recomputation.
 */

type Pane = "evidence" | "document" | "intelligence";

const STRENGTH_TONE: Record<number, string> = {
  1: "text-muted-foreground",
  2: "text-muted-foreground",
  3: "text-foreground/70",
  4: "text-primary",
  5: "text-primary font-medium",
};

function ItemCard({
  item,
  onMove,
  onRemove,
}: {
  item: EvidenceItem;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const needsCheck = item.confidence < VERIFY_BELOW;
  return (
    <div className="border border-border/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          {item.organization && (
            <p className="text-xs text-muted-foreground truncate">{item.organization}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onMove(-1)} aria-label={`Move ${item.title} up`} className="p-1 hover:bg-secondary/70">
            <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button onClick={() => onMove(1)} aria-label={`Move ${item.title} down`} className="p-1 hover:bg-secondary/70">
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button onClick={onRemove} aria-label={`Remove ${item.title} from this résumé`} className="p-1 hover:bg-secondary/70">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Extraction is not fact. Anything parsed with low confidence says so
          rather than presenting itself as something the candidate wrote. */}
      {needsCheck && (
        <p className="mt-1.5 text-xs text-primary flex items-center gap-1">
          <AlertCircle className="w-3 h-3" aria-hidden />
          Needs verification — read this through before you send it
        </p>
      )}

      <ul className="mt-2 space-y-1.5">
        {item.bullets.map((b) => (
          <li key={b.id} className="text-xs">
            <span className="text-foreground/90">{b.text}</span>
            <span className={`ml-1.5 whitespace-nowrap ${STRENGTH_TONE[b.strength]}`}>
              · {EVIDENCE_STRENGTH_LABEL[b.strength]}
            </span>
            {/* Coaching appears on the bullet it refers to, and only asks. */}
            {b.prompts.length > 0 && b.strength < 4 && (
              <p className="mt-0.5 text-muted-foreground italic">{b.prompts[0]}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumeEditor({
  profile,
  initialDocument,
  onChange,
}: {
  profile: CareerProfile;
  /** A saved version to edit. Omitted, a starting document is derived. */
  initialDocument?: ResumeDocument;
  /** Called with the current document after every edit, so the owner can save. */
  onChange?: (doc: ResumeDocument) => void;
}) {
  const [doc, setDoc] = useState<ResumeDocument>(() => initialDocument ?? buildDocument(profile));
  const [pane, setPane] = useState<Pane>("document");

  /**
   * Apply an edit and notify the owner.
   *
   * Every mutation routes through here so no path can change the document
   * without the page learning about it — a save button that silently misses an
   * edit is worse than no save button.
   */
  const edit = (fn: (d: ResumeDocument) => ResumeDocument) =>
    setDoc((current) => {
      const next = fn(current);
      onChange?.(next);
      return next;
    });

  // Recomputed from the document, never stored — so the panel cannot go stale
  // relative to what the candidate is looking at.
  const resolved = useMemo(() => resolveDocument(doc, profile), [doc, profile]);
  const spare = useMemo(() => unusedItems(doc, profile), [doc, profile]);
  const report = useMemo(() => xray(profile), [profile]);
  const lines = useMemo(() => estimateLines(doc, profile), [doc, profile]);
  const pages = Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
  const overflow = lines - LINES_PER_PAGE;

  const paneClass = (p: Pane) =>
    `flex-1 text-sm py-2 border-b-2 transition-colors ${
      pane === p ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"
    }`;

  return (
    <div className="w-full">
      {/* Mobile: one pane at a time. Shrinking three columns onto a phone is
          what the spec explicitly rules out. */}
      <div className="flex lg:hidden border-b border-border" role="tablist">
        {(["evidence", "document", "intelligence"] as Pane[]).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={paneClass(p)}>
            {p === "evidence" ? "Evidence" : p === "document" ? "Résumé" : "Analysis"}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-6 mt-4">
        {/* ---------------- Evidence ---------------- */}
        <aside className={`${pane === "evidence" ? "block" : "hidden"} lg:block`}>
          <h3 className="text-sm font-semibold text-foreground">Your evidence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everything we know about your career. Add what belongs on this version.
          </p>
          {spare.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Every piece of evidence is on this résumé.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {spare.map((item) => {
                const target = doc.sections.find((s) => s.kind === item.kind);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-2 border border-border/60 p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.kind}</p>
                    </div>
                    <button
                      disabled={!target}
                      onClick={() => target && edit((d) => addItem(d, target.id, item.id))}
                      aria-label={`Add ${item.title} to the résumé`}
                      className="p-1 hover:bg-secondary/70 disabled:opacity-40 shrink-0"
                    >
                      <Plus className="w-4 h-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ---------------- Document ---------------- */}
        <main className={`${pane === "document" ? "block" : "hidden"} lg:block`}>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{doc.name}</h3>
            <p className="text-xs text-muted-foreground">
              {/* Labelled an estimate, because it is one — a real count needs
                  the rendered document. */}
              about {pages} page{pages === 1 ? "" : "s"} (estimated)
            </p>
          </div>

          {overflow > 0 && (
            <p className="mt-2 text-xs text-primary">
              Roughly {overflow} line{overflow === 1 ? "" : "s"} past one page. Shorten a bullet or
              hide a section — we won&apos;t compress it for you and make it unreadable.
            </p>
          )}

          {resolved.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              Your career story starts here. Add evidence from the left to build this résumé.
            </p>
          )}

          <div className="mt-4 space-y-6">
            {resolved.map(({ section, items }) => (
              <section key={section.id}>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                    {section.heading}
                  </h4>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => edit((d) => moveSection(d, section.id, -1))} aria-label={`Move ${section.heading} up`} className="p-1 hover:bg-secondary/70">
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button onClick={() => edit((d) => moveSection(d, section.id, 1))} aria-label={`Move ${section.heading} down`} className="p-1 hover:bg-secondary/70">
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button onClick={() => edit((d) => toggleSection(d, section.id))} aria-label={`Hide ${section.heading}`} className="p-1 hover:bg-secondary/70">
                      <EyeOff className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                {section.kind === "summary" && (
                  <p className="mt-2 text-sm text-foreground/90">{profile.identity.summary}</p>
                )}
                {section.kind === "skills" && (
                  <p className="mt-2 text-sm text-foreground/90">{profile.declaredSkills.join(" · ")}</p>
                )}

                <div className="mt-2 space-y-2">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onMove={(delta) => edit((d) => moveItem(d, section.id, item.id, delta))}
                      onRemove={() => edit((d) => removeItem(d, section.id, item.id))}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Hidden sections stay recoverable — hiding is never deletion. */}
          {doc.sections.some((s) => !s.visible) && (
            <div className="mt-6 pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground">Hidden</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {doc.sections.filter((s) => !s.visible).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => edit((d) => toggleSection(d, s.id))}
                    className="text-xs border border-border px-2 py-1 hover:bg-secondary/70 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" aria-hidden />
                    {s.heading}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ---------------- Intelligence ---------------- */}
        <aside className={`${pane === "intelligence" ? "block" : "hidden"} lg:block`}>
          <h3 className="text-sm font-semibold text-foreground">What this proves</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diagnostic dimensions, not a grade. Each one shows its own arithmetic.
          </p>

          <ul className="mt-3 space-y-2.5">
            {report.dimensions.map((d) => (
              <li key={d.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{d.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{d.score}%</span>
                </div>
                <div className="mt-1 h-1 bg-secondary/70">
                  <div className="h-full bg-primary" style={{ width: `${d.score}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d.why}</p>
                {d.how && <p className="mt-0.5 text-xs text-foreground/80">{d.how}</p>}
              </li>
            ))}
          </ul>

          {report.opportunities.length > 0 && (
            <div className="mt-5 pt-3 border-t border-border/60">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" aria-hidden />
                Fix next
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{report.opportunities[0].how}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
