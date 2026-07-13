import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { resolveProvider } from "./llmProvider";
import { parseResumeText } from "./resumeParser";
import { JOB_FIELDS } from "./matchScore";

const VALID_FIELDS = new Set<string>(JOB_FIELDS);

/**
 * LLM-based résumé parsing. Replaces the brittle keyword/regex heuristics (which
 * invented skills like "AI" from substring noise and mangled experience) with a
 * real read of the résumé. Works for ANY field — it extracts whatever skills the
 * candidate actually has, tech or not. Falls back to the heuristic parser if no
 * LLM key is set or the call fails, so upload never breaks.
 *
 * Optional fields are .nullable() (not .optional()) so strict json_schema
 * providers (Groq gpt-oss) accept the schema; null is treated as absent.
 */
const parsedResumeSchema = z.object({
  name: z.string().describe("The candidate's full name, exactly as written."),
  email: z.string().nullable(),
  title: z.string().nullable().describe("Current or most recent role / professional headline."),
  summary: z.string().nullable().describe("A 2–3 sentence professional summary, if present."),
  skills: z
    .array(z.string())
    .describe(
      "Concrete, matchable skills the candidate ACTUALLY has — technologies, tools, software, platforms, certifications, domain competencies — for their real field (tech, sales, marketing, finance, ops, healthcare, etc.). Use each skill's SHORT canonical name as it appears in job postings (e.g. \"JavaScript\", \"React\", \"Node.js\", \"MongoDB\", \"AWS\", \"Salesforce\", \"Excel\") — no version numbers, parentheticals, or qualifiers. Exclude vague soft skills unless the résumé lists them explicitly."
    ),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        duration: z.string().nullable().describe('e.g. "Jun 2024 – Present"'),
        description: z.string().nullable().describe("One concise line on what they did."),
      })
    )
    .describe(
      "Work history. Include internships and — for freshers/students with no formal jobs — notable projects (use the project name as `role` and a short descriptor or \"Personal Project\" as `company`)."
    ),
  education: z.array(z.string()).describe("Each degree / institution as one line."),
  targetFields: z
    .array(z.string())
    .describe(
      "The 1–3 fields that best match the candidate's background, chosen ONLY from this exact list (lowercase): it, engineering, sales, marketing, finance, customer-service, hr, admin, retail, logistics, healthcare, teaching, hospitality, creative, consultancy, manufacturing. (Software/web/data/AI → \"it\".)"
    ),
});

export interface ParsedResume {
  name: string;
  email: string;
  title: string;
  summary: string;
  skills: string[];
  experience: { role: string; company: string; duration?: string; description?: string }[];
  education: string[];
  targetFields: string[];
  rawText: string;
}

const SYSTEM =
  "You are an expert résumé parser. Extract the candidate's real information EXACTLY as written — never invent, infer, or add anything not in the text. Skills must be concrete, matchable competencies (technologies, tools, software, platforms, certifications, domain skills) for the candidate's actual field, whatever it is. Do NOT output generic soft skills like \"communication\" or \"teamwork\" unless the résumé lists them explicitly. Return only what the résumé contains.";

export async function parseResumeWithLLM(text: string): Promise<ParsedResume | null> {
  const provider = resolveProvider();
  if (!provider) return null;
  const { object } = await generateObject({
    model: provider.model,
    schema: parsedResumeSchema,
    schemaName: "ParsedResume",
    system: SYSTEM,
    prompt: `Parse this résumé into structured data:\n\n${text.slice(0, 12000)}`,
    temperature: 0.1,
  });
  return {
    name: object.name || "Your Profile",
    email: object.email || "",
    title: object.title || "",
    summary: object.summary || "",
    skills: object.skills || [],
    experience: (object.experience || []).map((e) => ({
      role: e.role,
      company: e.company,
      duration: e.duration || undefined,
      description: e.description || undefined,
    })),
    education: object.education || [],
    // Keep only valid taxonomy fields (guard against the model inventing labels).
    targetFields: (object.targetFields || [])
      .map((f) => f.toLowerCase().trim())
      .filter((f) => VALID_FIELDS.has(f)),
    rawText: text,
  };
}

/** LLM parse with a graceful fallback to the heuristic parser (upload never fails). */
export async function parseResume(text: string): Promise<ParsedResume> {
  try {
    const llm = await parseResumeWithLLM(text);
    if (llm && (llm.skills.length > 0 || llm.experience.length > 0)) return llm;
  } catch (e) {
    console.error("LLM résumé parse failed, using heuristic fallback:", e instanceof Error ? e.message : e);
  }
  return { ...parseResumeText(text), targetFields: [] };
}
