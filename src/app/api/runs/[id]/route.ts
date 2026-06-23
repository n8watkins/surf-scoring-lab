import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRun, getAppState, updateRunOutcomeNote } from "@/lib/db";

export const runtime = "nodejs";

const patchSchema = z.object({
  outcomeNote: z.string().max(2000).nullable(),
});

/** Add or edit the outcome note on a previous run, after reviewing its result. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outcome note." }, { status: 400 });
  }

  const note = parsed.data.outcomeNote?.trim() ? parsed.data.outcomeNote.trim() : null;
  const run = updateRunOutcomeNote(id, note);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ run, state: getAppState() });
}

/** Delete a single run (grade) from history. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!deleteRun(id)) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ state: getAppState() });
}
