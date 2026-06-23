import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "success" | "warn" | "danger" | "info";

const toneBadge: Record<Tone, string> = {
  neutral: "border-zinc-700 bg-zinc-900 text-zinc-300",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
  warn: "border-amber-800 bg-amber-950/60 text-amber-300",
  danger: "border-red-800 bg-red-950/60 text-red-300",
  info: "border-sky-800 bg-sky-950/60 text-sky-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${toneBadge[tone]}`}>
      {children}
    </span>
  );
}

const toneNotice: Record<Tone, string> = {
  neutral: "border-zinc-800 bg-zinc-900/60 text-zinc-300",
  success: "border-emerald-900 bg-emerald-950/40 text-emerald-200",
  warn: "border-amber-900 bg-amber-950/40 text-amber-200",
  danger: "border-red-900 bg-red-950/40 text-red-200",
  info: "border-sky-900 bg-sky-950/40 text-sky-200",
};

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-lg border px-3 py-2 text-sm ${toneNotice[tone]}`}>{children}</div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
};

const variants = {
  primary:
    "bg-teal-400 text-zinc-950 font-semibold hover:bg-teal-300 disabled:bg-teal-400/40 disabled:text-zinc-950/60",
  secondary:
    "border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-50",
  ghost: "text-zinc-300 hover:bg-zinc-900 disabled:opacity-50",
};

export function Button({ variant = "secondary", icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{children}</span>;
}

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-teal-500";

export const selectClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-200 outline-none transition focus:border-teal-500";
