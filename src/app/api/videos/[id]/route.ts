import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { deleteVideo, getAppState, getVideo } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const video = getVideo(id);

  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const fileStat = await stat(video.localPath).catch(() => null);
  if (!fileStat) {
    return NextResponse.json({ error: "Video file is missing from local storage." }, { status: 404 });
  }

  const range = request.headers.get("range");
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
  });

  if (!range) {
    headers.set("Content-Length", String(fileStat.size));
    return new Response(Readable.toWeb(createReadStream(video.localPath)) as ReadableStream, {
      status: 200,
      headers,
    });
  }

  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(null, { status: 416 });
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : fileStat.size - 1;

  if (start >= fileStat.size || end >= fileStat.size || start > end) {
    return new Response(null, { status: 416 });
  }

  headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);
  headers.set("Content-Length", String(end - start + 1));

  return new Response(
    Readable.toWeb(createReadStream(video.localPath, { start, end })) as ReadableStream,
    {
      status: 206,
      headers,
    },
  );
}

/** Remove a saved video from the local library (and its file on disk). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const video = getVideo(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const removed = deleteVideo(id);
  if (!removed) {
    return NextResponse.json(
      { error: "This video is used by a saved run and cannot be removed." },
      { status: 409 },
    );
  }

  await unlink(video.localPath).catch(() => {});
  return NextResponse.json({ state: getAppState() });
}
