"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-900/60 bg-red-950/50 text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-100">{state.title}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{state.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
