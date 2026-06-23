import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { insertVideo } from "@/lib/db";
import { MAX_VIDEO_BYTES } from "@/lib/starters";

export const runtime = "nodejs";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "surf-video.mp4";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("video");
  const durationValue = formData.get("duration");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Select one MP4 file to upload." }, { status: 400 });
  }

  const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
  if (!isMp4) {
    return NextResponse.json({ error: "Only MP4 uploads are supported in v0.1." }, { status: 400 });
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "The selected file is larger than the 50 MB limit." }, { status: 400 });
  }

  const duration =
    typeof durationValue === "string" && Number.isFinite(Number(durationValue))
      ? Number(durationValue)
      : null;

  const videosDir = path.join(process.cwd(), "data", "videos");
  await mkdir(videosDir, { recursive: true });

  const filename = `${randomUUID()}-${safeFilename(file.name)}`;
  const localPath = path.join(videosDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(localPath, bytes);

  const video = insertVideo({
    name: file.name,
    filename,
    localPath,
    fileSize: file.size,
    duration,
  });

  return NextResponse.json({ video });
}
