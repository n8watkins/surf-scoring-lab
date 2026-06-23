"use client";

import { useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Renders a timestamp using the *browser's* locale/timezone without risking a
 * hydration mismatch. The server snapshot is an empty placeholder, so the
 * server-rendered HTML and the first client render agree; React then swaps in
 * the locale-formatted value after hydration.
 */
export function Time({ value, className }: { value: string; className?: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatDate(value),
    () => "",
  );
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text || "…"}
    </time>
  );
}
