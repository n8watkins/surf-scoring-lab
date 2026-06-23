import type { ExperimentRun } from "@/lib/types";
import { summarizeGrade } from "@/lib/grade";

/** Trigger a client-side file download from in-memory text. */
export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flatten the run history into a spreadsheet-friendly CSV. */
export function runsToCsv(runs: ExperimentRun[]): string {
  const header = [
    "run",
    "video",
    "score",
    "gradable",
    "status",
    "parseStatus",
    "latencyMs",
    "prompt",
    "rubric",
    "hypothesis",
    "outcomeNote",
    "createdAt",
  ];
  const rows = runs.map((r) => {
    const g = summarizeGrade(r.parsedResponse);
    return [
      r.runNumber,
      r.videoName,
      g.score ?? "",
      g.gradable === null ? "" : g.gradable,
      r.status,
      r.parseStatus,
      r.latencyMs ?? "",
      r.promptName,
      r.rubricName,
      r.hypothesis ?? "",
      r.outcomeNote ?? "",
      r.createdAt,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
