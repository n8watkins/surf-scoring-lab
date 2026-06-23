import type { ParseStatus } from "@/lib/types";

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/** Parse text as JSON without any rewriting or repair. */
export function safeParseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

/**
 * Pull the JSON candidate out of a model response.
 *
 * Per the product spec we are deliberately conservative: we try the raw text
 * directly, and if that is wrapped in a single Markdown ```json fence we use
 * the fenced contents. We do NOT attempt to repair arbitrary malformed JSON.
 */
export function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }
  return trimmed;
}

export type ParsedResponse = {
  parseStatus: ParseStatus;
  value: unknown | null;
  /** Human-readable reason when parsing did not succeed. */
  error: string | null;
};

/** Classify a raw Gemini response into a parse status + parsed value. */
export function parseModelResponse(raw: string | null | undefined): ParsedResponse {
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    return { parseStatus: "empty_response", value: null, error: "Gemini returned an empty response." };
  }

  const candidate = extractJsonCandidate(raw);
  const parsed = safeParseJson(candidate);
  if (parsed.ok) {
    return { parseStatus: "valid_json", value: parsed.value, error: null };
  }

  return { parseStatus: "invalid_json", value: null, error: parsed.error };
}
