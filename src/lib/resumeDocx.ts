import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import type { StructuredResume } from "./resumeTailor";

/**
 * Deterministic, ATS-safe .docx renderer. Single column, standard section order
 * and headings, standard font (Calibri), real text + real bullets, no tables /
 * columns / images / text boxes / headers-footers. Because WE own the layout,
 * every generated résumé is ATS-parseable by construction (see RESUME_TAILORING_PLAN §2).
 */

// Sizes are half-points (docx convention): 22 = 11pt.
const BODY = 21; // ~10.5pt
const NAME = 32; // 16pt
const SMALL = 18; // 9pt
const HEAD = 22; // 11pt

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: HEAD, color: "222222" })],
  });
}

function body(text: string, opts: { size?: number; italics?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: opts.size ?? BODY, italics: opts.italics })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: BODY })],
  });
}

function buildChildren(r: StructuredResume): Paragraph[] {
  const out: Paragraph[] = [];

  // Header: name + single contact line.
  out.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: r.contact.name, bold: true, size: NAME })],
    })
  );
  const contact = [r.contact.email, r.contact.phone, r.contact.location, ...(r.contact.links ?? [])]
    .filter(Boolean)
    .join("  |  ");
  if (contact) out.push(body(contact, { size: SMALL }));

  // Summary
  if (r.summary?.trim()) {
    out.push(heading("Professional Summary"));
    out.push(body(r.summary));
  }

  // Skills
  if (r.skills?.length) {
    out.push(heading("Skills"));
    out.push(body(r.skills.join(" • ")));
  }

  // Experience
  if (r.experience?.length) {
    out.push(heading("Work Experience"));
    for (const e of r.experience) {
      out.push(
        new Paragraph({
          spacing: { before: 100, after: 10 },
          children: [
            new TextRun({ text: e.role, bold: true, size: BODY }),
            new TextRun({ text: e.company ? `  —  ${e.company}` : "", size: BODY }),
          ],
        })
      );
      const meta = [e.location, [e.start, e.end].filter(Boolean).join(" – ")].filter(Boolean).join("  |  ");
      if (meta) out.push(body(meta, { size: SMALL, italics: true }));
      for (const b of e.bullets ?? []) out.push(bullet(b));
    }
  }

  // Education
  if (r.education?.length) {
    out.push(heading("Education"));
    for (const ed of r.education) {
      out.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: ed.degree, bold: true, size: BODY }),
            new TextRun({ text: ed.institution ? `, ${ed.institution}` : "", size: BODY }),
            new TextRun({ text: ed.year ? `  (${ed.year})` : "", size: SMALL }),
          ],
        })
      );
    }
  }

  // Projects (optional)
  if (r.projects?.length) {
    out.push(heading("Projects"));
    for (const p of r.projects) {
      out.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: `${p.name}: `, bold: true, size: BODY }),
            new TextRun({ text: p.description, size: BODY }),
          ],
        })
      );
    }
  }

  // Certifications (optional)
  if (r.certifications?.length) {
    out.push(heading("Certifications"));
    for (const c of r.certifications) out.push(bullet(c));
  }

  return out;
}

/** Render a structured résumé into an ATS-safe .docx and return the file bytes. */
export async function renderResumeDocx(resume: StructuredResume): Promise<Buffer> {
  const doc = new Document({
    creator: "UMBRIX",
    title: `${resume.contact.name} — Résumé`,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: BODY },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: buildChildren(resume),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Safe filename like "Guruprasad_Jena_Razorpay_Frontend_Engineer.docx". */
export function resumeFileName(name: string, company: string, role: string): string {
  const clean = (s: string) => (s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `${[clean(name), clean(company), clean(role)].filter(Boolean).join("_") || "resume"}.docx`;
}
