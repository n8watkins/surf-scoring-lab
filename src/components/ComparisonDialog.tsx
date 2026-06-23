"use client";

import { X } from "lucide-react";
import type { ExperimentRun } from "@/lib/types";
import { Badge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { summarizeGrade } from "@/lib/grade";
import { formatLatency } from "@/lib/format";

export function ComparisonDialog({ runs, onClose }: { runs: [ExperimentRun, ExperimentRun]; onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      labelledBy="compare-title"
      className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 id="compare-title" className="text-base font-semibold text-zinc-100">
          Compare Run {runs[0].runNumber} vs Run {runs[1].runNumber}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-auto bg-zinc-800 sm:grid-cols-2">
        {runs.map((run) => (
          <RunColumn key={run.id} run={run} />
        ))}
      </div>
    </Modal>
  );
}

function RunColumn({ run }: { run: ExperimentRun }) {
  const grade = summarizeGrade(run.parsedResponse);
  return (
    <div className="space-y-4 bg-zinc-950 p-5">
      <div className="flex items-center gap-3">
        {grade.score !== null ? (
          <span className="text-3xl font-semibold text-teal-300">{grade.score}</span>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge>Run {run.runNumber}</Badge>
          {grade.gradable === true ? <Badge tone="success">Gradable</Badge> : null}
          {grade.gradable === false ? <Badge tone="warn">Not gradable</Badge> : null}
          <RunStatusBadge status={run.status} />
        </div>
      </div>

      <Row label="Video" value={run.videoName} />
      <Row label="Latency" value={formatLatency(run.latencyMs)} />
      <Row label="Prompt" value={`${run.promptName}${run.promptVersionNumber ? ` v${run.promptVersionNumber}` : ""}`} />
      <Row label="Rubric" value={`${run.rubricName}${run.rubricVersionNumber ? ` v${run.rubricVersionNumber}` : ""}`} />
      <Row label="Output" value={`${run.outputFormatName}${run.outputFormatVersionNumber ? ` v${run.outputFormatVersionNumber}` : ""}`} />

      <Block label="Hypothesis" content={run.hypothesis ?? "—"} />
      <Block label="Outcome note" content={run.outcomeNote ?? "—"} />
      <Block label="Summary" content={grade.summary ?? "—"} />
      <Block label="Prompt snapshot" content={run.promptSnapshot} mono />
      <Block label="Raw response" content={run.rawResponse ?? run.errorMessage ?? "—"} mono />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-zinc-900 pb-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right text-zinc-200">{value}</span>
    </div>
  );
}

function Block({ label, content, mono }: { label: string; content: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 text-xs leading-5 text-zinc-300 ${
          mono ? "font-mono" : ""
        }`}
      >
        {content}
      </pre>
    </div>
  );
}
