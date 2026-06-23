/**
 * Best-effort extraction of human-meaningful fields from an arbitrary parsed
 * Gemini response. The app never assumes a fixed response shape, so these
 * helpers look for common field names and fail gracefully (returning null)
 * when they are absent. Unknown structures are still rendered in full by the
 * JSON tree elsewhere.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Case-insensitive lookup of the first matching key. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowered = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const actual = lowered.get(key.toLowerCase());
    if (actual !== undefined) return obj[actual];
  }
  return undefined;
}

/** A numeric overall score if the response exposes one. */
export function extractScore(value: unknown): number | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const raw = pick(obj, ["overallScore", "score", "totalScore", "finalScore"]);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return null;
}

/** Tri-state gradability: true / false / unknown(null). */
export function extractGradable(value: unknown): boolean | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const raw = pick(obj, ["gradable", "isGradable", "canGrade"]);
  if (typeof raw === "boolean") return raw;
  return null;
}

export function extractSummary(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const raw = pick(obj, ["summary", "overallSummary", "overview", "feedback"]);
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

export function extractStringList(value: unknown, keys: string[]): string[] {
  const obj = asRecord(value);
  if (!obj) return [];
  const raw = pick(obj, keys);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      const rec = asRecord(item);
      if (rec) {
        const text = pick(rec, ["text", "description", "detail", "note"]);
        if (typeof text === "string") return text;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item && item.trim()));
}

export type GradeSummary = {
  score: number | null;
  gradable: boolean | null;
  summary: string | null;
};

/** Compact summary used by history rows and the result header. */
export function summarizeGrade(value: unknown): GradeSummary {
  return {
    score: extractScore(value),
    gradable: extractGradable(value),
    summary: extractSummary(value),
  };
}
