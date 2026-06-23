"use client";

import { useState, type ReactNode } from "react";
import { ClipboardCheck, Loader2, NotebookPen } from "lucide-react";
import type { AppStatePayload, ExperimentRun } from "@/lib/types";
import { Badge, Button, Notice, inputClass } from "@/components/ui";
import { GradeView } from "@/components/GradeView";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { Time } from "@/components/Time";
import { summarizeGrade } from "@/lib/grade";
import { formatLatency } from "@/lib/format";

type Tab = "formatted" | "raw" | "request";

export function ResultCard({
  run,
  onOutcomeUpdated,
}: {
  run: ExperimentRun;
  onOutcomeUpdated: (run: ExperimentRun, state: AppStatePayload) => void;
}) {
  // The parent remounts this component (key={run.id}) when a different run is
  // shown, so initialising from props here is enough to reset on run change.
  const [tab, setTab] = useState<Tab>("formatted");
  const [note, setNote] = useState(run.outcomeNote ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const grade = summarizeGrade(run.parsedResponse);
  const noteDirty = (note.trim() || null) !== (run.outcomeNote ?? null);

  async function saveNote() {
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeNote: note.trim() || null }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not save the note.");
      onOutcomeUpdated(payload.run as ExperimentRun, payload.state as AppStatePayload);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : "Could not save the note.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {grade.score !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tabular-nums text-teal-300">{grade.score}</span>
              <span className="text-sm text-zinc-500">score</span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400">Run {run.runNumber}</span>
            {grade.gradable === true ? <Badge tone="success">Gradable</Badge> : null}
            {grade.gradable === false ? <Badge tone="warn">Not gradable</Badge> : null}
            <RunStatusBadge status={run.status} />
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          <Time value={run.createdAt} /> · {formatLatency(run.latencyMs)} · {run.model}
        </div>
      </div>

      {grade.summary ? <p className="text-sm leading-6 text-zinc-300">{grade.summary}</p> : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(
          [
            ["formatted", "Formatted"],
            ["raw", "Raw response"],
            ["request", "Request details"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === key
                ? "border-teal-400 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "formatted" ? (
        run.parseStatus === "valid_json" && run.parsedResponse !== null ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <GradeView value={run.parsedResponse} />
          </div>
        ) : (
          <div className="space-y-3">
            <Notice tone={run.status === "success" ? "info" : "warn"}>
              {run.errorMessage ??
                "Gemini returned a response, but it was not valid JSON. The raw response is still available below."}
            </Notice>
            <RawBlock text={run.rawResponse} />
          </div>
        )
      ) : null}

      {tab === "raw" ? <RawBlock text={run.rawResponse ?? run.errorMessage} /> : null}

      {tab === "request" ? <RequestDetails run={run} /> : null}

      {/* Outcome note */}
      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <NotebookPen className="h-3.5 w-3.5" />
          Outcome note
        </label>
        <textarea
          className={`${inputClass} min-h-[4.5rem] resize-y`}
          placeholder="After reviewing this result, note what you learned…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {noteError ? <Notice tone="danger">{noteError}</Notice> : null}
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={saveNote}
            disabled={!noteDirty || savingNote}
            icon={savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          >
            Save note
          </Button>
        </div>
      </div>
    </div>
  );
}

function RawBlock({ text }: { text: string | null | undefined }) {
  return (
    <pre className="max-h-[460px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-200">
      {text || "No response text was returned."}
    </pre>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-zinc-200">{value}</dd>
    </div>
  );
}

function Snapshot({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
        {content}
      </pre>
    </div>
  );
}

function RequestDetails({ run }: { run: ExperimentRun }) {
  const ver = (name: string, n: number | null) => (n ? `${name} · v${n}` : `${name} (unsaved)`);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <Detail label="Model" value={run.model} />
        <Detail label="Video" value={run.videoName} />
        <Detail label="Latency" value={formatLatency(run.latencyMs)} />
        <Detail label="Parse status" value={run.parseStatus.replace(/_/g, " ")} />
        <Detail label="Prompt" value={ver(run.promptName, run.promptVersionNumber)} />
        <Detail label="Rubric" value={ver(run.rubricName, run.rubricVersionNumber)} />
        <Detail label="Output" value={ver(run.outputFormatName, run.outputFormatVersionNumber)} />
        <Detail label="Started" value={<Time value={run.createdAt} />} />
      </dl>
      {run.hypothesis ? <Snapshot label="Hypothesis" content={run.hypothesis} /> : null}
      {run.errorMessage ? (
        <Notice tone="danger">{run.errorMessage}</Notice>
      ) : null}
      <Snapshot label="Assembled request (exact text sent to Gemini)" content={run.assembledRequest} />
      <Snapshot label="Prompt snapshot" content={run.promptSnapshot} />
      <Snapshot label="Rubric snapshot" content={run.rubricSnapshot} />
      <Snapshot label="Output format snapshot" content={run.outputFormatSnapshot} />
    </div>
  );
}
