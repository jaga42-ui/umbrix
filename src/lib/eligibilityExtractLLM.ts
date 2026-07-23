import "server-only";
import { generateObject } from "ai";
import { resolveProvider } from "./llmProvider";
import { assembleResults, type ExtractedEligibility } from "./eligibilitySanitize";
import { batchEligibilitySchema, ELIGIBILITY_SYSTEM, buildEligibilityPrompt } from "./eligibilityPrompt";

/**
 * LLM eligibility extraction from a job description. Regex extraction (in the
 * ingest pipeline) hit its ceiling — ~half of postings state experience in ways
 * rules can't catch. This reads the JD and pulls the eligibility fields the
 * posting explicitly states, for ANY field.
 *
 * Schema, system prompt, and prompt-building live in ./eligibilityPrompt (pure)
 * so the precision-gate script exercises exactly what ships. Validation lives in
 * ./eligibilitySanitize. Batched (many JDs per call) to stay within free-tier
 * request quotas.
 */
export async function extractEligibilityBatch(
  items: { id: string; title: string; content: string }[]
): Promise<Map<string, ExtractedEligibility>> {
  const provider = resolveProvider();
  if (!provider || items.length === 0) return new Map();

  const { object } = await generateObject({
    model: provider.model,
    schema: batchEligibilitySchema,
    schemaName: "JobEligibilityBatch",
    system: ELIGIBILITY_SYSTEM,
    prompt: buildEligibilityPrompt(items),
    temperature: 0,
  });

  return assembleResults(items.map((i) => i.id), object.jobs);
}
