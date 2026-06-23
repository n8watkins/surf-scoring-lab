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

export function toPublicError(error: unknown) {
  if (error instanceof Error) {
    if (/api[_ ]?key/i.test(error.message)) {
      return "Gemini rejected the API key. Open Settings and enter a valid key.";
    }
    return error.message;
  }
  return "The Gemini request failed.";
}
