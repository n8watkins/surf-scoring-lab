import { NextResponse } from "next/server";
import { z } from "zod";
import { clearApiKey, getKeyStatus, setApiKey } from "@/lib/settings";

export const runtime = "nodejs";

const bodySchema = z.object({
  apiKey: z.string().trim().min(10, "That key looks too short.").max(400),
});

export function GET() {
  return NextResponse.json({ key: getKeyStatus() });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid API key." },
      { status: 400 },
    );
  }

  setApiKey(parsed.data.apiKey);
  return NextResponse.json({ key: getKeyStatus() });
}

export function DELETE() {
  clearApiKey();
  return NextResponse.json({ key: getKeyStatus() });
}
