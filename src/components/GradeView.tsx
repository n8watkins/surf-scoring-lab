import { Check, Minus, X } from "lucide-react";
import type { ReactNode } from "react";

/** camelCase / snake_case → "Title Case" for friendly labels. */
function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function Scalar({ value }: { value: string | number | boolean | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-500">
        <Minus className="h-3.5 w-3.5" /> none
      </span>
    );
  }
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-300">
        <Check className="h-3.5 w-3.5" /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-red-300">
        <X className="h-3.5 w-3.5" /> No
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-amber-200">{value}</span>;
  }
  return <span className="whitespace-pre-wrap break-words text-zinc-100">{value || "—"}</span>;
}

function Node({ value }: { value: unknown }): ReactNode {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <Scalar value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-500">none</span>;

    const allScalar = value.every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    );
    if (allScalar) {
      return (
        <ul className="space-y-1">
          {value.map((item, i) => (
            <li key={i} className="flex gap-2 text-zinc-100">
              <span className="select-none text-teal-500">•</span>
              <Node value={item} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <Node value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-zinc-500">none</span>;
    return (
      <div className="space-y-3">
        {entries.map(([key, child]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
            <div className="text-sm font-medium text-zinc-400">{humanize(key)}</div>
            <div className="min-w-0 text-sm">
              <Node value={child} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-zinc-500">—</span>;
}

/** Renders an arbitrary parsed Gemini response in a readable, label-driven way. */
export function GradeView({ value }: { value: unknown }) {
  return <Node value={value} />;
}
