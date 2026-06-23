import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppState, insertOutputFormatVersion, insertVersion } from "@/lib/db";
import { safeParseJson } from "@/lib/json";

export const runtime = "nodejs";

/**
 * Save a single new immutable version of a prompt, rubric, or output format.
 * Versions are saved explicitly and independently (never a blanket "Save").
 * Reusing a name increments that name's version number.
 */
const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prompt"),
    name: z.string().trim().min(1).max(120),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("rubric"),
    name: z.string().trim().min(1).max(120),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("output"),
    name: z.string().trim().min(1).max(120),
    content: z.string().min(1),
    mode: z.literal("example").default("example"),
  }),
]);

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Could not save version.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.type === "output") {
    const json = safeParseJson(data.content);
    if (!json.ok) {
      return NextResponse.json(
        { error: `Output format is not valid JSON: ${json.error}` },
        { status: 400 },
      );
    }
    const version = insertOutputFormatVersion(data.name, data.mode, data.content);
    return NextResponse.json({ version, state: getAppState() });
  }

  const table = data.type === "prompt" ? "prompt_versions" : "rubric_versions";
  const version = insertVersion(table, data.name, data.content);
  return NextResponse.json({ version, state: getAppState() });
}
