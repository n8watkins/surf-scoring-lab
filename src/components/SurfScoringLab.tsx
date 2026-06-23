"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  HelpCircle,
  KeyRound,
  Loader2,
  Play,
  Settings2,
  Trash2,
  Waves,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  AppStatePayload,
  ExperimentRun,
  KeyStatus,
  PublicVideo,
  VersionRecord,
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
import { downloadFile, runsToCsv } from "@/lib/export";
import { Badge, Button, Notice, inputClass } from "@/components/ui";
import { VideoPanel } from "@/components/VideoPanel";
import { ExperimentSetup, type EditorField } from "@/components/ExperimentSetup";
import { ResultCard } from "@/components/ResultCard";
import { HistoryList } from "@/components/HistoryList";
import { ComparisonDialog } from "@/components/ComparisonDialog";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { ConfirmDialog, type ConfirmState } from "@/components/ConfirmDialog";

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
  const [currentVideo, setCurrentVideo] = useState<PublicVideo | null>(initialState.videos[0] ?? null);
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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  // Auto-dismiss success/info messages; keep warnings/errors until dismissed.
  useEffect(() => {
    if (status && (status.tone === "success" || status.tone === "info")) {
      const timer = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [status]);

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

  const analyzeReason = !state.key.configured
    ? "Add your Gemini API key first (top right)."
    : !hasVideo
      ? "Upload or pick a clip first."
      : videoSize > MAX_VIDEO_BYTES
        ? "This clip is over the 50 MB limit."
        : fileError
          ? fileError
          : !jsonValidation.ok
            ? "Fix the Output JSON in Experiment setup."
            : null;

  const analyzeDisabled = isAnalyzing || analyzeReason !== null;

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

  function pickLibraryVideo(video: PublicVideo) {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(video);
    setDuration(video.duration);
    setFileError(null);
  }

  function deleteLibraryVideo(video: PublicVideo) {
    setConfirm({
      title: "Remove video",
      message: `Remove “${video.name}” from your library? (A video used by a saved grade can't be removed.)`,
      confirmLabel: "Remove video",
      onConfirm: () => void doDeleteLibraryVideo(video),
    });
  }

  async function doDeleteLibraryVideo(video: PublicVideo) {
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

  async function ensureUploadedVideo(): Promise<PublicVideo> {
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
    const video = payload.video as PublicVideo;
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
    // Clear any pending local selection so the duplicate uses this run's video.
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setSelectedFile(null);
    setCurrentVideo(video);
    setDuration(video?.duration ?? null);
    setSetupOpen(true);
    setStatus({ tone: "info", text: "Duplicated. Change one thing, then Analyze to create a new run." });
  }

  function exportHistoryJson() {
    downloadFile("surf-grades.json", JSON.stringify(state.runs, null, 2), "application/json");
  }

  function exportHistoryCsv() {
    downloadFile("surf-grades.csv", runsToCsv(state.runs), "text/csv");
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 2 ? [...ids, id] : [ids[1], id],
    );
  }

  function deleteRun(run: ExperimentRun) {
    setConfirm({
      title: "Delete grade",
      message: `Run ${run.runNumber} and its result will be permanently removed. The uploaded video stays in your library.`,
      confirmLabel: "Delete grade",
      onConfirm: () => void doDeleteRun(run),
    });
  }

  async function doDeleteRun(run: ExperimentRun) {
    try {
      const res = await fetch(`/api/runs/${run.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not delete the run.");
      const newState = payload.state as AppStatePayload;
      setState(newState);
      setCompareIds((ids) => ids.filter((id) => id !== run.id));
      if (result?.id === run.id) setResult(newState.runs[0] ?? null);
      setStatus({ tone: "info", text: `Deleted Run ${run.runNumber}.` });
    } catch (e) {
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : "Could not delete the run." });
    }
  }

  function clearAllRuns() {
    setConfirm({
      title: "Clear all grades",
      message: `All ${state.runs.length} grades will be permanently removed. Your uploaded videos stay in the library.`,
      confirmLabel: "Clear all",
      onConfirm: () => void doClearAllRuns(),
    });
  }

  async function doClearAllRuns() {
    try {
      const res = await fetch("/api/runs", { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not clear history.");
      setState(payload.state as AppStatePayload);
      setCompareIds([]);
      setResult(null);
      setStatus({ tone: "info", text: "Cleared all previous grades." });
    } catch (e) {
      setStatus({ tone: "danger", text: e instanceof Error ? e.message : "Could not clear history." });
    }
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
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How it works
            </Link>
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
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-base font-semibold text-zinc-100">Welcome to Surf Scoring Lab 🌊</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Grade short surf clips with Gemini and compare prompts, rubrics, and outputs. Three steps
              to your first grade:
            </p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              <OnboardStep n={1} title="Add your API key">
                Stored only on this machine, used server-side.
                <div className="mt-2">
                  <Button variant="primary" onClick={() => setKeyOpen(true)} icon={<KeyRound className="h-4 w-4" />}>
                    Add API key
                  </Button>
                </div>
              </OnboardStep>
              <OnboardStep n={2} title="Upload a clip">
                Drag in one MP4 (one ride, under 30s works best).
              </OnboardStep>
              <OnboardStep n={3} title="Analyze">
                Click <span className="text-zinc-200">Analyze video</span> — Gemini is only called then.
              </OnboardStep>
            </ol>
          </section>
        ) : null}

        {status ? (
          <Notice tone={status.tone} onDismiss={() => setStatus(null)}>
            {status.text}
          </Notice>
        ) : null}

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

              <button
                type="button"
                onClick={() => setSetupOpen((v) => !v)}
                aria-expanded={setupOpen}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3.5 py-2.5 text-left transition hover:border-zinc-500"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                    <Settings2 className="h-4 w-4 text-teal-300" />
                    Experiment setup
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {setupOpen
                      ? "Edit the prompt, rubric & output JSON — click to hide"
                      : `Prompt: ${prompt.name} · Rubric: ${rubric.name} · Output: ${output.name}`}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition ${setupOpen ? "rotate-180" : ""}`}
                />
              </button>

              <Button
                variant="primary"
                onClick={analyze}
                disabled={analyzeDisabled}
                icon={isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                className="py-3 text-base"
              >
                {isAnalyzing ? "Analyzing…" : "Analyze video"}
              </Button>
              <p className={`text-center text-xs ${analyzeReason ? "text-amber-400/80" : "text-zinc-600"}`}>
                {analyzeReason ?? "Gemini is contacted only when you click Analyze."}
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Previous grades{state.runs.length ? ` (${state.runs.length})` : ""}
            </h2>
            {state.runs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={exportHistoryJson} icon={<Download className="h-4 w-4" />}>
                  JSON
                </Button>
                <Button variant="ghost" onClick={exportHistoryCsv} icon={<Download className="h-4 w-4" />}>
                  CSV
                </Button>
                <Button variant="danger" onClick={clearAllRuns} icon={<Trash2 className="h-4 w-4" />}>
                  Clear all
                </Button>
              </div>
            ) : null}
          </div>
          <HistoryList
            runs={state.runs}
            activeRunId={result?.id ?? null}
            compareIds={compareIds}
            onOpen={loadRun}
            onDuplicate={duplicateRun}
            onDelete={deleteRun}
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

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {compareOpen && compareRuns.length === 2 ? (
        <ComparisonDialog
          runs={[compareRuns[0], compareRuns[1]]}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </main>
  );
}

function OnboardStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/15 text-xs font-semibold text-teal-300">
          {n}
        </span>
        <span className="text-sm font-medium text-zinc-100">{title}</span>
      </div>
      <div className="mt-2 text-xs leading-5 text-zinc-400">{children}</div>
    </li>
  );
}
