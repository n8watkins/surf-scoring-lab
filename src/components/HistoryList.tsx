"use client";

import { Copy, GitCompareArrows, Star, Trash2 } from "lucide-react";
import type { ExperimentRun } from "@/lib/types";
import { Button, EmptyState } from "@/components/ui";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { Time } from "@/components/Time";
import { scoreBand, summarizeGrade } from "@/lib/grade";
import { formatLatency } from "@/lib/format";

type Props = {
  runs: ExperimentRun[];
  activeRunId: string | null;
  compareIds: string[];
  onOpen: (run: ExperimentRun) => void;
  onDuplicate: (run: ExperimentRun) => void;
  onDelete: (run: ExperimentRun) => void;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
};

export function HistoryList(props: Props) {
  if (props.runs.length === 0) {
    return <EmptyState>Your runs will appear here, newest first, with their grades.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {props.compareIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
          <span>{props.compareIds.length}/2 selected to compare</span>
          <Button
            variant="primary"
            onClick={props.onCompare}
            disabled={props.compareIds.length !== 2}
            icon={<GitCompareArrows className="h-4 w-4" />}
          >
            Compare
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {props.runs.map((run) => {
          const grade = summarizeGrade(run.parsedResponse);
          const active = run.id === props.activeRunId;
          const checked = props.compareIds.includes(run.id);
          return (
            <li
              key={run.id}
              className={`rounded-xl border p-3 transition ${
                active ? "border-teal-600 bg-teal-500/5" : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => props.onOpen(run)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <ScoreChip score={grade.score} gradable={grade.gradable} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">Run {run.runNumber}</span>
                      <RunStatusBadge status={run.status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {run.videoName} · {run.promptName} / {run.rubricName}
                    </div>
                    {run.outcomeNote ? (
                      <div className="mt-1 line-clamp-2 text-xs italic text-zinc-400">“{run.outcomeNote}”</div>
                    ) : null}
                    <div className="mt-1 text-[11px] text-zinc-600">
                      <Time value={run.createdAt} /> · {formatLatency(run.latencyMs)}
                    </div>
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => props.onDuplicate(run)}
                      title="Duplicate into the editors"
                      aria-label={`Duplicate Run ${run.runNumber} into the editors`}
                      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => props.onDelete(run)}
                      title="Delete this grade"
                      aria-label={`Delete Run ${run.runNumber}`}
                      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-950/50 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <label
                    className="flex items-center gap-1 text-[11px] text-zinc-500"
                    title="Select to compare"
                  >
                    <input
                      type="checkbox"
                      className="accent-teal-400"
                      checked={checked}
                      onChange={() => props.onToggleCompare(run.id)}
                    />
                    compare
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SCORE_CHIP: Record<"low" | "mid" | "high", { box: string; star: string; num: string }> = {
  low: { box: "border-red-800/50 bg-red-500/10", star: "text-red-300", num: "text-red-200" },
  mid: { box: "border-amber-800/50 bg-amber-500/10", star: "text-amber-300", num: "text-amber-200" },
  high: { box: "border-teal-700/50 bg-teal-500/10", star: "text-teal-300", num: "text-teal-200" },
};

function ScoreChip({ score, gradable }: { score: number | null; gradable: boolean | null }) {
  if (score !== null) {
    const c = SCORE_CHIP[scoreBand(score)];
    return (
      <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border ${c.box}`}>
        <Star className={`h-3 w-3 ${c.star}`} />
        <span className={`text-sm font-semibold tabular-nums ${c.num}`}>{score}</span>
      </div>
    );
  }
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-[10px] uppercase ${
        gradable === false
          ? "border-amber-800 bg-amber-950/40 text-amber-300"
          : "border-zinc-800 bg-zinc-900 text-zinc-500"
      }`}
    >
      {gradable === false ? "n/a" : "—"}
    </div>
  );
}
