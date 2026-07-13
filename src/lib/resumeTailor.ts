import "server-only";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * AI résumé tailoring. The model outputs structured résumé *data* (this schema),
 * never a document — we render the ATS-safe .docx ourselves (see resumeDocx.ts).
 * Hard rule enforced in the prompt: rephrase/reorder/emphasize the user's real
 * résumé to match the job; NEVER invent employers, roles, dates, degrees, or
 * skills the user doesn't have.
 */

export const resumeSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: z.string().describe("2–4 sentence professional summary targeted at this job."),
  skills: z.array(z.string()).describe("Skills ordered by relevance to the job; only skills the user actually has."),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        location: z.string().optional(),
        start: z.string().optional().describe('e.g. "Jan 2024"'),
        end: z.string().optional().describe('e.g. "Present"'),
        bullets: z.array(z.string()).describe("Impact-focused bullets rephrased toward the job's keywords; factual."),
      })
    )
    .describe("Reverse-chronological."),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string().optional(),
    })
  ),
  projects: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
  certifications: z.array(z.string()).optional(),
});

export type StructuredResume = z.infer<typeof resumeSchema>;

export interface TailorProfile {
  name: string;
  email?: string;
  title?: string;
  summary?: string;
  skills: string[];
  experience: { role?: string; company?: string; duration?: string; description?: string }[];
  education: string[];
  rawText?: string;
}

export interface TailorJob {
  title: string;
  company: string;
  description?: string;
  tags?: string[];
  minExperience?: number | null;
}

export const RESUME_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are an expert résumé writer and ATS (applicant tracking system) optimization specialist for the Indian job market.

Your job: rewrite a candidate's résumé so it is tightly targeted to ONE specific job posting and passes ATS keyword screening.

ABSOLUTE RULES — never break these:
- TRUTHFUL ONLY. Use only facts present in the candidate's source résumé. Never invent or exaggerate employers, job titles, dates, degrees, certifications, metrics, or skills the candidate does not have. If the source lacks a number, do not fabricate one.
- You MAY reorder, rephrase, re-emphasize, and tighten existing content, and surface relevant skills the candidate genuinely has.
- Weave the job's important keywords and terminology naturally into the summary, skills, and experience bullets — only where they truthfully apply. No keyword stuffing.
- Keep it concise, professional, and achievement-oriented. Prefer strong action verbs. Keep bullets to one line each where possible.
- Order skills and experience by relevance to the target job. Reverse-chronological experience.
- Output must fit the provided schema exactly.`;

function buildPrompt(profile: TailorProfile, job: TailorJob): string {
  const exp = profile.experience
    .map(
      (e, i) =>
        `  ${i + 1}. ${[e.role, e.company].filter(Boolean).join(" @ ")}${
          e.duration ? ` (${e.duration})` : ""
        }${e.description ? `\n     ${e.description}` : ""}`
    )
    .join("\n");

  return `TARGET JOB
Title: ${job.title}
Company: ${job.company}
${job.tags?.length ? `Key skills/tags: ${job.tags.join(", ")}\n` : ""}${
    job.minExperience != null ? `Experience required: ${job.minExperience} years\n` : ""
  }Description:
${(job.description || "(no description provided)").slice(0, 6000)}

CANDIDATE'S SOURCE RÉSUMÉ
Name: ${profile.name}
${profile.email ? `Email: ${profile.email}\n` : ""}${profile.title ? `Current title: ${profile.title}\n` : ""}${
    profile.summary ? `Summary: ${profile.summary}\n` : ""
  }Skills: ${profile.skills.join(", ") || "(none listed)"}
Experience:
${exp || "  (none listed)"}
Education: ${profile.education.join("; ") || "(none listed)"}
${profile.rawText ? `\nFull résumé text (source of truth for any detail):\n${profile.rawText.slice(0, 8000)}` : ""}

Produce the tailored résumé for the target job, following every rule.`;
}

/** Whether tailoring is possible (a Gemini key is configured). */
export const tailoringConfigured = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export async function tailorResume(profile: TailorProfile, job: TailorJob): Promise<StructuredResume> {
  const { object } = await generateObject({
    model: google(RESUME_MODEL),
    schema: resumeSchema,
    schemaName: "TailoredResume",
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(profile, job),
    temperature: 0.4,
  });
  // Guarantee the candidate's real name/contact survive regardless of model output.
  object.contact.name = object.contact.name || profile.name;
  if (!object.contact.email && profile.email) object.contact.email = profile.email;
  return object;
}
