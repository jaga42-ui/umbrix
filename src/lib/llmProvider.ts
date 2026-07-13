import "server-only";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Single place that picks the LLM provider by which free API key is present —
 * Groq preferred (generous free tier, no regional 0-quota wall), Gemini as a
 * fallback. Shared by résumé tailoring and résumé parsing. Returns null when no
 * key is configured so callers can degrade gracefully.
 */
export function resolveProvider(): { model: LanguageModel; id: string } | null {
  if (process.env.GROQ_API_KEY) {
    // gpt-oss-120b supports strict json_schema structured output (llama-3.3 does not).
    return { model: groq("openai/gpt-oss-120b"), id: "groq/gpt-oss-120b" };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google("gemini-2.0-flash"), id: "google/gemini-2.0-flash" };
  }
  return null;
}

/** The model id that would be used right now (for storage/telemetry). */
export function activeModelId(): string {
  return resolveProvider()?.id ?? "none";
}

/** Whether any LLM provider is configured. */
export function llmConfigured(): boolean {
  return resolveProvider() !== null;
}
