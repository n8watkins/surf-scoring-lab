import { NextResponse } from "next/server";
import { deleteAllRuns, getAppState } from "@/lib/db";

export const runtime = "nodejs";

/** Clear all runs (grades) from history. */
export function DELETE() {
  const removed = deleteAllRuns();
  return NextResponse.json({ removed, state: getAppState() });
}
