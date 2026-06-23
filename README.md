# Surf Scoring Lab

A private, local dashboard for experimenting with Gemini prompts, rubrics, and
JSON output formats against short surfing videos.

This is intentionally a **lab**, not an official scoring system. The starter
prompt, rubric, and output presets are editable starting points — the app never
implies that any single prompt, rubric, or score is objectively correct.

## Run locally

```bash
cd /home/natkins/projects/surf-scoring-lab
npm install
npm run dev
```

Open http://localhost:3333 and click **Add API key** in the header to paste a
Gemini API key. The key is stored locally (in the SQLite database), used only on
the server, and never sent to the browser or shown again after saving.

> Prefer an environment variable? `npm run setup:key` writes `GEMINI_API_KEY` to
> `.env.local`. An in-app key always takes precedence over the env var.

## The loop

1. **Upload / pick a clip** — drag an MP4 in, or re-select one from *Your
   uploads*. Nothing is sent to Gemini on selection.
2. **(Optional) open Experiment setup** — edit the prompt, rubric, and the
   example JSON you want back. Save independent, immutable versions of each.
3. **Analyze video** — the only point at which Gemini is contacted.
4. **Read the grade** — the result card shows the score/gradability up top,
   a readable rendering of the response, the raw text, and the exact request.
5. **Review history** — every run is saved with its grade, snapshots, latency,
   and errors. Reopen a run with its exact inputs, duplicate it, add an outcome
   note, or select two runs to compare side by side.

## Model

The model is locked to `gemini-3.1-flash-lite` and shown read-only in the
header. Change it in one place: `LOCKED_MODEL` in `src/lib/starters.ts`.

## Local files

- `.env.local` — optional `GEMINI_API_KEY` (git-ignored).
- `data/surf-scoring-lab.sqlite` — runs, versions, uploaded-video metadata, and
  the locally stored API key (git-ignored).
- `data/videos/` — uploaded MP4 files, stored under generated filenames
  (git-ignored).

The browser never calls Gemini directly; all requests flow through the local
Next.js server, which is the only place the API key is read.

## How runs stay reproducible

Each run stores an **immutable snapshot** of the exact prompt, rubric, output
format, and the assembled request sent to Gemini — not just references to
version records. Editing or deleting a version later never changes a past run,
and a run can be made from unsaved editor content.

## Project layout

```
src/
  app/
    page.tsx                  server-renders initial state
    api/
      analyze/route.ts        upload to Gemini, wait for ACTIVE, run, snapshot
      settings/route.ts       get / set / clear the local API key
      versions/route.ts       save one immutable prompt|rubric|output version
      runs/[id]/route.ts      PATCH a run's outcome note
      upload/route.ts         store an MP4 locally (UUID filename)
      videos/[id]/route.ts    serve (byte-range) / delete a stored MP4
  components/                 split UI: VideoPanel, ExperimentSetup, ResultCard,
                              GradeView, HistoryList, ComparisonDialog, …
  lib/
    db.ts                     SQLite schema, migration, repositories
    settings.ts               API-key resolution (in-app store → env fallback)
    gemini.ts                 client + wait-for-active + cleanup
    json.ts / json.test.ts    conservative response parser (+ tests)
    grade.ts                  best-effort score/summary extraction
    prompt-assembly.ts        builds the exact request text
```

## Checks

```bash
npm run lint          # eslint
npm test              # node --test (parser unit tests, zero deps)
npm run build         # production build + typecheck
```

## Requirements

- Node 22.5+ (uses the built-in `node:sqlite` module; developed on Node 24).
