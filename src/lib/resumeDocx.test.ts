import { test } from "node:test";
import assert from "node:assert/strict";
import { renderResumeDocx, resumeFileName } from "./resumeDocx";
import type { StructuredResume } from "./resumeTailor";

const sample: StructuredResume = {
  contact: { name: "Guruprasad Jena", email: "g@example.com", location: "Bengaluru, India" },
  summary: "Frontend engineer focused on React and TypeScript.",
  skills: ["React", "TypeScript", "Node.js"],
  experience: [
    {
      role: "Frontend Engineer",
      company: "Acme",
      start: "Jan 2024",
      end: "Present",
      bullets: ["Built the design system used across 5 products.", "Cut page load time by 40%."],
    },
  ],
  education: [{ degree: "B.Tech CSE", institution: "NIT", year: "2023" }],
};

test("renders a valid .docx (zip) buffer", async () => {
  const buf = await renderResumeDocx(sample);
  assert.ok(Buffer.isBuffer(buf), "returns a Buffer");
  assert.ok(buf.length > 1000, "buffer is non-trivial");
  // .docx is a zip → starts with the PK signature.
  assert.equal(buf.subarray(0, 2).toString("latin1"), "PK");
});

test("renders with optional sections omitted", async () => {
  const minimal: StructuredResume = {
    contact: { name: "Jane Doe" },
    summary: "",
    skills: [],
    experience: [],
    education: [],
  };
  const buf = await renderResumeDocx(minimal);
  assert.ok(buf.length > 500);
});

test("resumeFileName sanitizes and joins", () => {
  assert.equal(
    resumeFileName("Guruprasad Jena", "Razorpay", "Frontend Engineer"),
    "Guruprasad_Jena_Razorpay_Frontend_Engineer.docx"
  );
  assert.equal(resumeFileName("", "", ""), "resume.docx");
});
