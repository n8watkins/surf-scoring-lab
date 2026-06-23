import { FileState, GoogleGenAI, type File as GenAiFile } from "@google/genai";

let cached: { key: string; client: GoogleGenAI } | null = null;

/** Build (or reuse) a Gemini client for the given key. */
export function getGeminiClient(apiKey: string) {
  if (cached && cached.key === apiKey) return cached.client;
  const client = new GoogleGenAI({ apiKey });
  cached = { key: apiKey, client };
  return client;
}

/**
 * Uploaded videos start in PROCESSING and cannot be referenced until they
 * reach ACTIVE. Poll until the file is usable (or fails / times out). Without
 * this, generateContent intermittently fails with "file is not in an ACTIVE
 * state" for anything but the smallest clips.
 */
export async function waitForActiveFile(
  ai: GoogleGenAI,
  file: GenAiFile,
  { timeoutMs = 90_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<GenAiFile> {
  const name = file.name;
  if (!name) throw new Error("Gemini did not return a file name to poll.");

  const deadline = Date.now() + timeoutMs;
  let current = file;

  while (current.state === FileState.PROCESSING) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for Gemini to finish processing the video.");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    current = await ai.files.get({ name });
  }

  if (current.state === FileState.FAILED) {
    throw new Error("Gemini could not process the uploaded video.");
  }

  return current;
}

/** Best-effort cleanup of an uploaded Gemini file. Never throws. */
export async function deleteGeminiFile(ai: GoogleGenAI, name: string | undefined) {
  if (!name) return;
  try {
    await ai.files.delete({ name });
  } catch {
    // Files auto-expire on Gemini's side; ignore cleanup failures.
  }
}

export function toPublicError(error: unknown): string {
  if (!(error instanceof Error)) return "The Gemini request failed.";
  const raw = error.message;

  // The SDK often embeds a JSON error body in the message; extract the inner
  // human message + numeric code so we can show something actionable.
  let inner = raw;
  let code: number | null = null;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const e = parsed?.error ?? parsed;
      if (typeof e?.message === "string") inner = e.message;
      if (typeof e?.code === "number") code = e.code;
    } catch {
      // not JSON — keep the raw message
    }
  }
  if (code === null) {
    const codeMatch = raw.match(/\b(4\d\d|5\d\d)\b/);
    if (codeMatch) code = Number(codeMatch[1]);
  }

  if (code === 429 || /RESOURCE_EXHAUSTED|quota|credits?\b.*deplet/i.test(raw)) {
    return `Gemini quota/credits exhausted (429). This is a billing limit on the API key's Google AI Studio project — not an app error. Add billing/credits in AI Studio, or paste a different key in Settings. (${inner})`;
  }
  if (code === 401 || code === 403 || /api[_ ]?key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(raw)) {
    return "Gemini rejected the API key (auth/permission). Open Settings and enter a valid key with access to this model.";
  }
  if (code === 404 || /NOT_FOUND|is not found|not supported/i.test(raw)) {
    return `Gemini could not use the requested model (404). Check the model id in src/lib/starters.ts. (${inner})`;
  }
  return inner || "The Gemini request failed.";
}
