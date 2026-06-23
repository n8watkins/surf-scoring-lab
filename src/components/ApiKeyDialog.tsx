"use client";

import { useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import type { KeyStatus } from "@/lib/types";
import { Button, Notice, inputClass } from "@/components/ui";

export function ApiKeyDialog({
  open,
  keyStatus,
  onClose,
  onApplied,
}: {
  open: boolean;
  keyStatus: KeyStatus;
  onClose: () => void;
  onApplied: (key: KeyStatus) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not save the key.");
      onApplied(payload.key as KeyStatus);
      setValue("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the key.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not clear the key.");
      onApplied(payload.key as KeyStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear the key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
            <KeyRound className="h-4 w-4 text-teal-300" />
            Gemini API key
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            Your key is stored locally on this machine and used only on the server to call Gemini.
            It is never sent to the browser or shown again after saving.
          </p>

          {keyStatus.configured ? (
            <Notice tone="success">
              A key is configured{keyStatus.hint ? ` (ends in …${keyStatus.hint})` : ""}
              {keyStatus.fromEnv ? ", from the GEMINI_API_KEY environment variable" : ""}.
            </Notice>
          ) : (
            <Notice tone="warn">No key configured yet.</Notice>
          )}

          <input
            className={inputClass}
            type="password"
            autoComplete="off"
            placeholder="Paste a Gemini API key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) save();
            }}
          />

          {error ? <Notice tone="danger">{error}</Notice> : null}
        </div>

        <div className="mt-5 flex items-center justify-between">
          {keyStatus.configured && !keyStatus.fromEnv ? (
            <Button variant="ghost" onClick={clear} disabled={busy}>
              Remove stored key
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={busy || value.trim().length < 10}
              icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              Save key
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
