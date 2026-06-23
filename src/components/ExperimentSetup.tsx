"use client";

import { useState } from "react";
import { Braces, FileText, ListChecks, Loader2, RefreshCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import type { OutputFormatVersionRecord, VersionRecord } from "@/lib/types";
import { Button, FieldLabel, Notice, inputClass, selectClass } from "@/components/ui";

export type EditorField = {
  name: string;
  content: string;
  versionId: string | null;
};

type EditorType = "prompt" | "rubric" | "output";

type Props = {
  prompt: EditorField;
  rubric: EditorField;
  output: EditorField;
  promptVersions: VersionRecord[];
  rubricVersions: VersionRecord[];
  outputVersions: OutputFormatVersionRecord[];
  rubricPresets: { name: string; content: string }[];
  outputPresets: { name: string; content: string }[];
  jsonValid: boolean;
  jsonMessage: string;
  saving: Record<EditorType, boolean>;
  onName: (type: EditorType, value: string) => void;
  onContent: (type: EditorType, value: string) => void;
  onLoadVersion: (type: EditorType, id: string) => void;
  onApplyPreset: (type: EditorType, name: string) => void;
  onRestoreStarter: (type: "prompt" | "output") => void;
  onFormatJson: () => void;
  onSaveVersion: (type: EditorType) => void;
};

const TABS: { type: EditorType; label: string; icon: ReactNode }[] = [
  { type: "prompt", label: "Prompt", icon: <FileText className="h-4 w-4" /> },
  { type: "rubric", label: "Rubric", icon: <ListChecks className="h-4 w-4" /> },
  { type: "output", label: "Output JSON", icon: <Braces className="h-4 w-4" /> },
];

const GUIDANCE: Record<EditorType, string> = {
  prompt: "Tell Gemini what to observe, what not to guess, and how to score or abstain.",
  rubric: "Define your criteria and scoring. This is your rubric — there is no single correct one.",
  output: "An example of the JSON you want back. It guides Gemini but does not guarantee the shape.",
};

export function ExperimentSetup(props: Props) {
  const [tab, setTab] = useState<EditorType>("prompt");

  const field = props[tab];
  const versions =
    tab === "prompt" ? props.promptVersions : tab === "rubric" ? props.rubricVersions : props.outputVersions;
  const presets = tab === "rubric" ? props.rubricPresets : tab === "output" ? props.outputPresets : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.type}
            onClick={() => setTab(t.type)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t.type
                ? "bg-zinc-100 text-zinc-950"
                : "border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {t.icon}
            {t.label}
            {tab !== t.type && t.type === "output" && !props.jsonValid ? (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 space-y-1">
          <FieldLabel>{tab} name</FieldLabel>
          <input
            className={inputClass}
            value={field.name}
            onChange={(e) => props.onName(tab, e.target.value)}
          />
        </label>

        <select
          className={selectClass}
          value=""
          onChange={(e) => {
            if (e.target.value) props.onLoadVersion(tab, e.target.value);
            e.currentTarget.selectedIndex = 0;
          }}
        >
          <option value="">Load version…</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · v{v.version}
            </option>
          ))}
        </select>

        {presets ? (
          <select
            className={selectClass}
            value=""
            onChange={(e) => {
              if (e.target.value) props.onApplyPreset(tab, e.target.value);
              e.currentTarget.selectedIndex = 0;
            }}
          >
            <option value="">Preset…</option>
            {presets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <textarea
        className={`min-h-[18rem] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm leading-6 text-zinc-100 outline-none focus:border-teal-500 ${
          tab === "output" ? "font-mono" : ""
        }`}
        value={field.content}
        spellCheck={false}
        onChange={(e) => props.onContent(tab, e.target.value)}
      />

      {tab === "output" ? (
        <Notice tone={props.jsonValid ? "success" : "danger"}>
          {props.jsonValid ? "Valid JSON." : `Invalid JSON: ${props.jsonMessage}`}
        </Notice>
      ) : null}

      <p className="text-xs text-zinc-500">{GUIDANCE[tab]}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <div className="flex flex-wrap gap-2">
          {tab === "output" ? (
            <Button variant="ghost" onClick={props.onFormatJson} disabled={!props.jsonValid} icon={<Braces className="h-4 w-4" />}>
              Format
            </Button>
          ) : null}
          {tab !== "rubric" ? (
            <Button
              variant="ghost"
              onClick={() => props.onRestoreStarter(tab)}
              icon={<RefreshCcw className="h-4 w-4" />}
            >
              Restore starter
            </Button>
          ) : null}
        </div>
        <Button
          variant="secondary"
          onClick={() => props.onSaveVersion(tab)}
          disabled={props.saving[tab] || (tab === "output" && !props.jsonValid)}
          icon={props.saving[tab] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          Save new {tab} version
        </Button>
      </div>
    </div>
  );
}
