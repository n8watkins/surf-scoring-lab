"use client";

import { useRef, useState } from "react";
import { Film, Trash2, Upload, X } from "lucide-react";
import type { PublicVideo } from "@/lib/types";
import { Notice } from "@/components/ui";
import { formatBytes, formatSeconds } from "@/lib/format";

type Props = {
  videoSrc: string | null;
  videoName: string;
  videoSize: number;
  duration: number | null;
  isLocalOnly: boolean;
  hasVideo: boolean;
  fileError: string | null;
  durationWarning: string | null;
  library: PublicVideo[];
  currentVideoId: string | null;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  onPick: (video: PublicVideo) => void;
  onDelete: (video: PublicVideo) => void;
  onDuration: (duration: number) => void;
};

export function VideoPanel(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-4">
      {props.videoSrc ? (
        <div className="space-y-3">
          <video
            key={props.videoSrc}
            className="aspect-video w-full rounded-xl border border-zinc-800 bg-black"
            src={props.videoSrc}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d)) props.onDuration(d);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-100">{props.videoName}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {formatBytes(props.videoSize)} · {formatSeconds(props.duration)} ·{" "}
                {props.isLocalOnly ? "Local preview — not yet sent to Gemini" : "Saved locally"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
              >
                Replace
              </button>
              <button
                onClick={props.onRemove}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-red-700 hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            props.onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-teal-400 bg-teal-500/5"
              : "border-zinc-700 bg-zinc-950/40 hover:border-teal-500/60"
          }`}
        >
          <Upload className="h-7 w-7 text-teal-300" />
          <span className="text-sm font-medium text-zinc-100">Drop an MP4 here or click to browse</span>
          <span className="max-w-xs text-xs text-zinc-500">
            For the clearest first experiments: one surfer, one ride, one continuous clip, under 30
            seconds. MP4 only, up to 50&nbsp;MB.
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="video/mp4,.mp4"
        onChange={(e) => props.onFile(e.target.files?.[0] ?? null)}
      />

      {props.fileError ? <Notice tone="danger">{props.fileError}</Notice> : null}
      {props.durationWarning ? <Notice tone="warn">{props.durationWarning}</Notice> : null}

      {props.library.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Your uploads ({props.library.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {props.library.map((video) => {
              const active = video.id === props.currentVideoId && !props.isLocalOnly;
              return (
                <div
                  key={video.id}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    active
                      ? "border-teal-500 bg-teal-500/10 text-teal-200"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <button
                    onClick={() => props.onPick(video)}
                    className="flex items-center gap-1.5"
                    title={`${video.name} · ${formatBytes(video.fileSize)}`}
                  >
                    <Film className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="max-w-[150px] truncate">{video.name}</span>
                  </button>
                  <button
                    onClick={() => props.onDelete(video)}
                    className="text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                    title="Remove from library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
