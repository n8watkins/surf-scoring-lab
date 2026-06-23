"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, KeyRound, Loader2, Play, Settings2, Waves } from "lucide-react";
import type {
  AppStatePayload,
  ExperimentRun,
  KeyStatus,
  VersionRecord,
  VideoRecord,
} from "@/lib/types";
import {
  LOCKED_MODEL,
  MAX_VIDEO_BYTES,
  RECOMMENDED_SECONDS,
  outputPresets,
  rubricPresets,
  starterPrompt,
} from "@/lib/starters";
import { formatSeconds } from "@/lib/format";
import { Badge, Button, Notice, inputClass } from "@/components/ui";
import { VideoPanel } from "@/components/VideoPanel";
import { ExperimentSetup, type EditorField } from "@/components/ExperimentSetup";
import { ResultCard } from "@/components/ResultCard";
import { HistoryList } from "@/components/HistoryList";
import { ComparisonDialog } from "@/components/ComparisonDialog";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";

type StatusMessage = { tone: "info" | "success" | "danger" | "warn"; text: string } | null;
type EditorType = "prompt" | "rubric" | "output";

function fieldFromVersion(
  version: { id: string; name: string; content: string } | undefined,
  fallbackName: string,
  fallbackContent: string,
): EditorField {
  return {
    name: version?.name ?? fallbackName,
    content: version?.content ?? fallbackContent,
    versionId: version?.id ?? null,
  };
}

export function SurfScoringLab({ initialState }: { initialState: AppStatePayload }) {
  const [state, setState] = useState(initialState);

  // ---- Video selection ----
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoRecord | null>(initialState.videos[0] ?? null);
  const [duration, setDuration] = useState<number | null>(initialState.videos[0]?.duration ?? null);
  const [fileError, setFileError] = useState<string | null>(null);

  // ---- Editors ----
  const [prompt, setPrompt] = useState<EditorField>(
    fieldFromVersion(initialState.prompts[0], "Starter prompt", starterPrompt),
  );
  const [rubric, setRubric] = useState<EditorField>(
    fieldFromVersion(initialState.rubrics[0], rubricPresets[0].name, rubricPresets[0].content),
  );
  const [output, setOutput] = useState<EditorField>(
    fieldFromVersion(initialState.outputFormats[0], outputPresets[0].name, outputPresets[0].content),
  );
  const [hypothesis, setHypothesis] = useState("");

  // ---- Result / history ----
  const [result, setResult] = useState<ExperimentRun | null>(initialState.runs[0] ?? null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // ---- UI ----
  const [setupOpen, setSetupOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saving, setSaving] = useState<Record<EditorType, boolean>>({
    prompt: false,
    rubric: false,
    output: false,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  const jsonValidation = useMemo(() => {
    try {
      return { ok: true, value: JSON.parse(output.content), message: "" };
    } catch (e) {
      return { ok: false, value: null, message: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [output.content]);

  const videoSrc = localUrl ?? (currentVideo ? `/api/videos/${currentVideo.id}` : null);
  const videoName = selectedFile?.name ?? currentVideo?.name ?? "";
  const videoSize = selectedFile?.size ?? currentVideo?.fileSize ?? 0;
  const hasVideo = Boolean(selectedFile || currentVideo);
  const durationWarning =
    duration !== null && duration > RECOMMENDED_SECONDS
      ? `This clip is ${formatSeconds(duration)}. Shorter clips (under 30s) tend to give clearer first results.`
      : null;

  const analyzeDisabled =
    isAnalyzing ||
    !hasVideo ||
    !jsonValidation.ok ||
    videoSize > MAX_VIDEO_BYTES ||
    Boolean(fileError) ||
    !state.key.configured;

  // ---- Video handlers ----
  function setLocalVideo(file: File) {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setSelectedFile(file);
    setLocalUrl(URL.createObjectURL(file));
    setCurrentVideo(null);
    setDuration(null);
  }

  function handleFile(file: File | null) {
    setFileError(null);
    if (!file) return;
    const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
    if (!isMp4) {
      setFileError("Only MP4 files are supported.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFileError("That file is larger than the 50 MB limit.");
      return;
    }
    setLocalVideo(file);
  }

  function clearVideo() {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(null);
    setDuration(null);
    setFileError(null);
  }

  function pickLibraryVideo(video: VideoRecord) {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(video);
    setDuration(video.duration);
    setFileError(null);
  }

  async function deleteLibraryVideo(video: VideoRecord) {
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not remove the video.");
      setState(payload.state as AppStatePayload);
      if (currentVideo?.id === video.id) clearVideo();
      setStatus({ tone: "info", text: `Removed ${video.name} from your library.` });
    } catch (e) {
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : "Could not remove the video." });
    }
  }

  // ---- Editor handlers ----
  const editors: Record<EditorType, [EditorField, (f: EditorField) => void]> = {
    prompt: [prompt, setPrompt],
    rubric: [rubric, setRubric],
    output: [output, setOutput],
  };

  function onName(type: EditorType, value: string) {
    const [field, set] = editors[type];
    set({ ...field, name: value });
  }
  function onContent(type: EditorType, value: string) {
    const [field, set] = editors[type];
    set({ ...field, content: value });
  }
  function onLoadVersion(type: EditorType, id: string) {
    const list: VersionRecord[] =
      type === "prompt" ? state.prompts : type === "rubric" ? state.rubrics : state.outputFormats;
    const v = list.find((item) => item.id === id);
    if (!v) return;
    editors[type][1]({ name: v.name, content: v.content, versionId: v.id });
  }
  function onApplyPreset(type: EditorType, name: string) {
    const presets = type === "rubric" ? rubricPresets : outputPresets;
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    editors[type][1]({ name: preset.name, content: preset.content, versionId: null });
  }
  function onRestoreStarter(type: "prompt" | "output") {
    if (type === "prompt") {
      setPrompt({ name: "Starter prompt", content: starterPrompt, versionId: null });
    } else {
      setOutput({ name: outputPresets[0].name, content: outputPresets[0].content, versionId: null });
    }
  }
  function onFormatJson() {
    if (!jsonValidation.ok) return;
    setOutput({ ...output, content: JSON.stringify(jsonValidation.value, null, 2) });
  }

  async function onSaveVersion(type: EditorType) {
    const field = editors[type][0];
    setSaving((s) => ({ ...s, [type]: true }));
    try {
      const body =
        type === "output"
          ? { type, name: field.name, content: field.content, mode: "example" }
          : { type, name: field.name, content: field.content };
      const res = await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not save version.");
      setState(payload.state as AppStatePayload);
      editors[type][1]({ ...field, versionId: payload.version.id });
      setStatus({ tone: "success", text: `Saved ${payload.version.name} v${payload.version.version}.` });
    } catch (e) {
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : "Could not save version." });
    } finally {
      setSaving((s) => ({ ...s, [type]: false }));
    }
  }

  // Determine provenance: only attribute a run to a saved version if the
  // editor content still exactly matches that version.
  function provenance(type: EditorType) {
    const field = editors[type][0];
    const list: VersionRecord[] =
      type === "prompt" ? state.prompts : type === "rubric" ? state.rubrics : state.outputFormats;
    const v = field.versionId ? list.find((item) => item.id === field.versionId) : undefined;
    if (v && v.name === field.name && v.content === field.content) {
      return { id: v.id, number: v.version };
    }
    return { id: null, number: null };
  }

  async function ensureUploadedVideo(): Promise<VideoRecord> {
    if (!selectedFile) {
      if (!currentVideo) throw new Error("Select an MP4 before analyzing.");
      return currentVideo;
    }
    const form = new FormData();
    form.append("video", selectedFile);
    if (duration !== null) form.append("duration", String(duration));
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error ?? "Video upload failed.");
    const video = payload.video as VideoRecord;
    setState((cur) => ({ ...cur, videos: [video, ...cur.videos.filter((v) => v.id !== video.id)] }));
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(video);
    setDuration(video.duration);
    return video;
  }

  async function analyze() {
    if (!jsonValidation.ok) {
      setStatus({ tone: "danger", text: `Fix the output JSON first: ${jsonValidation.message}` });
      setSetupOpen(true);
      return;
    }
    setIsAnalyzing(true);
    setStatus({ tone: "info", text: "Uploading the clip and running Gemini…" });
    try {
      const video = await ensureUploadedVideo();
      const p = provenance("prompt");
      const r = provenance("rubric");
      const o = provenance("output");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          model: LOCKED_MODEL,
          promptName: prompt.name,
          prompt: prompt.content,
          promptVersionId: p.id,
          promptVersionNumber: p.number,
          rubricName: rubric.name,
          rubric: rubric.content,
          rubricVersionId: r.id,
          rubricVersionNumber: r.number,
          outputFormatName: output.name,
          outputFormatMode: "example",
          outputFormat: output.content,
          outputFormatVersionId: o.id,
          outputFormatVersionNumber: o.number,
          hypothesis: hypothesis.trim() || null,
        }),
      });
      const payload = await res.json();
      if (payload.state) setState(payload.state as AppStatePayload);
      if (payload.run) {
        const run = payload.run as ExperimentRun;
        setResult(run);
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus(
          run.status === "success"
            ? { tone: "success", text: `Run ${run.runNumber} completed.` }
            : { tone: "warn", text: run.errorMessage ?? `Run ${run.runNumber} finished with an issue.` },
        );
      } else if (!res.ok) {
        throw new Error(payload.error ?? "Analysis failed.");
      }
    } catch (e) {
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : "Analysis failed." });
    } finally {
      setIsAnalyzing(false);
    }
  }

  function loadRun(run: ExperimentRun) {
    setPrompt({ name: run.promptName, content: run.promptSnapshot, versionId: run.promptVersionId });
    setRubric({ name: run.rubricName, content: run.rubricSnapshot, versionId: run.rubricVersionId });
    setOutput({
      name: run.outputFormatName,
      content: run.outputFormatSnapshot,
      versionId: run.outputFormatVersionId,
    });
    setHypothesis(run.hypothesis ?? "");
    const video = state.videos.find((v) => v.id === run.videoId) ?? null;
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(video);
    setDuration(video?.duration ?? null);
    setResult(run);
    setStatus({ tone: "info", text: `Reopened Run ${run.runNumber} with its exact inputs.` });
  }

  function duplicateRun(run: ExperimentRun) {
    setPrompt({ name: `${run.promptName} copy`, content: run.promptSnapshot, versionId: null });
    setRubric({ name: `${run.rubricName} copy`, content: run.rubricSnapshot, versionId: null });
    setOutput({ name: `${run.outputFormatName} copy`, content: run.outputFormatSnapshot, versionId: null });
    setHypothesis(run.hypothesis ?? "");
    const video = state.videos.find((v) => v.id === run.videoId) ?? null;
    setCurrentVideo(video);
    setDuration(video?.duration ?? null);
    setSetupOpen(true);
    setStatus({ tone: "info", text: "Duplicated. Change one thing, then Analyze to create a new run." });
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 2 ? [...ids, id] : [ids[1], id],
    );
  }

  const compareRuns = compareIds
    .map((id) => state.runs.find((r) => r.id === id))
    .filter((r): r is ExperimentRun => Boolean(r));

  function onKeyApplied(key: KeyStatus) {
    setState((cur) => ({ ...cur, key }));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15">
              <Waves className="h-5 w-5 text-teal-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Surf Scoring Lab</h1>
              <p className="text-xs text-zinc-500">Local Gemini video experiment dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{LOCKED_MODEL}</Badge>
            <button
              onClick={() => setKeyOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                state.key.configured
                  ? "border-emerald-800 bg-emerald-950/50 text-emerald-300 hover:border-emerald-600"
                  : "border-amber-800 bg-amber-950/50 text-amber-300 hover:border-amber-600"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {state.key.configured ? "API key set" : "Add API key"}
            </button>
          </div>
        </header>

        {!state.key.configured ? (
          <Notice tone="warn">
            Add a Gemini API key to start analyzing. Click “Add API key” above — it’s stored locally and
            used only on the server.
          </Notice>
        ) : null}

        {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

        {/* Clip & run */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <VideoPanel
              videoSrc={videoSrc}
              videoName={videoName}
              videoSize={videoSize}
              duration={duration}
              isLocalOnly={Boolean(selectedFile)}
              hasVideo={hasVideo}
              fileError={fileError}
              durationWarning={durationWarning}
              library={state.videos}
              currentVideoId={currentVideo?.id ?? null}
              onFile={handleFile}
              onRemove={clearVideo}
              onPick={pickLibraryVideo}
              onDelete={deleteLibraryVideo}
              onDuration={setDuration}
            />

            <div className="flex flex-col gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Hypothesis (optional)
                </span>
                <textarea
                  className={`${inputClass} min-h-[4.5rem] resize-y`}
                  placeholder="e.g. Asking for timestamps will improve the maneuver detail."
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                />
              </label>

              <Button
                variant="secondary"
                onClick={() => setSetupOpen((v) => !v)}
                icon={<Settings2 className="h-4 w-4" />}
                className="justify-between"
              >
                <span>Experiment setup</span>
                <ChevronDown className={`h-4 w-4 transition ${setupOpen ? "rotate-180" : ""}`} />
              </Button>

              <Button
                variant="primary"
                onClick={analyze}
                disabled={analyzeDisabled}
                icon={isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                className="py-3 text-base"
              >
                {isAnalyzing ? "Analyzing…" : "Analyze video"}
              </Button>
              <p className="text-center text-xs text-zinc-600">
                Gemini is contacted only when you click Analyze.
              </p>
            </div>
          </div>

          {setupOpen ? (
            <div className="mt-5 border-t border-zinc-800 pt-5">
              <ExperimentSetup
                prompt={prompt}
                rubric={rubric}
                output={output}
                promptVersions={state.prompts}
                rubricVersions={state.rubrics}
                outputVersions={state.outputFormats}
                rubricPresets={rubricPresets}
                outputPresets={outputPresets}
                jsonValid={jsonValidation.ok}
                jsonMessage={jsonValidation.message}
                saving={saving}
                onName={onName}
                onContent={onContent}
                onLoadVersion={onLoadVersion}
                onApplyPreset={onApplyPreset}
                onRestoreStarter={onRestoreStarter}
                onFormatJson={onFormatJson}
                onSaveVersion={onSaveVersion}
              />
            </div>
          ) : null}
        </section>

        {/* Result */}
        <section ref={resultRef} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Result</h2>
          {result ? (
            <ResultCard
              key={result.id}
              run={result}
              onOutcomeUpdated={(run, newState) => {
                setResult(run);
                setState(newState);
              }}
            />
          ) : (
            <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center text-sm text-zinc-500">
              Upload a clip and click Analyze. The grade will appear here.
            </div>
          )}
        </section>

        {/* History */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Previous grades
          </h2>
          <HistoryList
            runs={state.runs}
            activeRunId={result?.id ?? null}
            compareIds={compareIds}
            onOpen={loadRun}
            onDuplicate={duplicateRun}
            onToggleCompare={toggleCompare}
            onCompare={() => setCompareOpen(true)}
          />
        </section>
      </div>

      <ApiKeyDialog
        open={keyOpen}
        keyStatus={state.key}
        onClose={() => setKeyOpen(false)}
        onApplied={onKeyApplied}
      />

      {compareOpen && compareRuns.length === 2 ? (
        <ComparisonDialog
          runs={[compareRuns[0], compareRuns[1]]}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </main>
  );
}
