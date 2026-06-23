import { deleteSetting, getSetting, setSetting } from "@/lib/db";
import type { KeyStatus } from "@/lib/types";

const API_KEY_SETTING = "gemini_api_key";

/**
 * Resolve the Gemini API key. An in-app key (stored locally in SQLite) takes
 * precedence; otherwise we fall back to the GEMINI_API_KEY environment
 * variable (e.g. set via `npm run setup:key`). Returns null when neither
 * is configured. This value is only ever read on the server.
 */
export function getApiKey(): string | null {
  const stored = getSetting(API_KEY_SETTING);
  if (stored && stored.trim()) return stored.trim();

  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  return null;
}

export function setApiKey(value: string) {
  setSetting(API_KEY_SETTING, value.trim());
}

export function clearApiKey() {
  deleteSetting(API_KEY_SETTING);
}

/** Whether the in-app store (as opposed to the env var) holds a key. */
function hasStoredKey(): boolean {
  const stored = getSetting(API_KEY_SETTING);
  return Boolean(stored && stored.trim());
}

/**
 * Safe-to-send key status for the UI. Never includes the full key — only
 * whether one is configured, where it came from, and the last 4 characters
 * for confirmation.
 */
export function getKeyStatus(): KeyStatus {
  const key = getApiKey();
  if (!key) {
    return { configured: false, hint: null, fromEnv: false };
  }
  return {
    configured: true,
    hint: key.length >= 4 ? key.slice(-4) : null,
    fromEnv: !hasStoredKey(),
  };
}
