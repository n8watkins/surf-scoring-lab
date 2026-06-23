# Surf Scoring Lab — Follow-up Ideas

A running backlog of ideas for after v1. Grouped by theme, each tagged with a
rough effort estimate:

- 🟢 **Quick win** — an afternoon or less
- 🟡 **Medium** — a focused day or two
- 🔴 **Large** — multi-day / structural

Nothing here is committed work; it's a menu. A few items are intentionally
*out of scope* for the "lab" stage and flagged as such.

---

## 1. Experimentation power (the core purpose)

The whole point is comparing prompts/rubrics/outputs. These sharpen that loop.

- 🟢 **"Re-run this exact config"** button on a history row — one click to
  reproduce a past run from its snapshot (today you reopen, then Analyze).
- 🟢 **Diff badge when duplicating** — show what changed vs. the run you
  duplicated from, so you know which single variable you're testing.
- 🟡 **Tag / label runs** and **filter the history** by video, status, score
  range, prompt name, or tag. History grows fast once you're iterating.
- 🟡 **Expose generation config** (temperature, topK, topP, thinking budget) as
  part of the experiment and snapshot it per run — prompt wording isn't the only
  variable worth testing. Centralize defaults next to `LOCKED_MODEL`.
- 🟡 **A/B helper** — pick two prompt (or rubric) versions, run both on the same
  clip, and auto-open the comparison view.
- 🔴 **Parameter sweep** — queue N runs varying one field and chart the spread.
  (Note: keep it *manual-trigger* per run to respect the "never auto-send"
  rule; this is sequencing UI, not a background batch worker.)

## 2. Result quality & visualization

- 🟡 **Click-to-seek timestamps** — when a response contains timestamps
  (`evidence[].timestamp`, `maneuvers[].timestamp`), render them as buttons that
  seek the `<video>` element. Probably the single highest-value surf-specific
  feature.
- 🟡 **Score trend** — a small chart of `overallScore` across runs for a given
  prompt+rubric, so you can see whether a prompt change actually moved scores.
- 🟡 **JSON diff in the comparison view** — highlight field-level differences
  between two runs' parsed responses instead of showing them side-by-side raw.
- 🟢 **Compare more than two runs** (matrix view) for wider sweeps.

## 3. Gemini integration & reliability

- 🟡 **Reuse uploaded files** — hash the video and reuse an existing Gemini file
  (they live ~48h) instead of re-uploading on every run. Faster + cheaper.
- 🟢 **Surface token usage / cost** — read `usageMetadata` from the response and
  show prompt/candidate token counts per run; helps reason about cost.
- 🟢 **Surface `finishReason` / safety blocks** explicitly rather than letting
  them fall through as a generic parse/empty error.
- 🟡 **Streaming** the response for faster first-token feedback on long clips.
- 🟡 **Retry with backoff** on transient 5xx / rate-limit errors before failing.
- 🟡 **JSON Schema output mode** — the data model already keeps a `mode` column;
  v0.1 deliberately shipped example-only. v1.1 could wire up
  `responseJsonSchema` with a schema editor + validation.

## 4. Data & robustness

- 🟢 **Delete a run** from history (today you can delete videos and save
  versions, but runs only accumulate).
- 🟢 **Export** a run — or all history — as JSON; **CSV export** of the history
  table (run #, score, status, latency, prompt name, notes) for spreadsheets.
- 🟡 **Video thumbnails** in the library — capture a frame client-side on upload
  and store it, so "Your uploads" is visual.
- 🟡 **Explicit schema versioning** — a `schema_version` table + ordered
  migrations instead of the current column-sniffing migration. Matters once
  there's real data to preserve across schema changes.

## 5. Code & infra quality

- 🟢 **GitHub Actions CI** — run `lint`, `test`, and `build` on every PR so a
  fork's changes stay green.
- 🟢 **Add a LICENSE** — pick one (MIT is the usual default for a shareable
  fork) so collaborators know the terms.
- 🟡 **Split `db.ts`** (~500 lines) into a `lib/repositories/` layer (videos,
  versions, runs, settings) as the schema grows.
- 🟡 **Shared API client** — a typed `fetchJson` helper to collapse the repeated
  `fetch → res.json() → if (!res.ok) throw` blocks in the components, with Zod
  validation of responses.
- 🟢 **More unit tests** — `grade.ts` extraction, `prompt-assembly.ts`, and the
  repositories against an in-memory SQLite DB.
- 🟢 **Toasts + error boundary** instead of the single status banner; loading
  skeletons for the result/history while fetching.

## 6. Fork-friendliness (a friend is going to clone this)

- 🟢 Seed an optional **sample run + sample clip** behind a "Load demo" button so
  a fresh clone shows something on first load (without needing a key).
- 🟢 A short **CONTRIBUTING / architecture** note (the README already has a
  layout map and the "How runs stay reproducible" section).
- 🟢 Document the **Node 22.5+ requirement** prominently (uses built-in
  `node:sqlite`) — already in the README, worth a `engines` field in
  `package.json`.

## 7. Beyond the lab — explicitly out of scope for now

These were deliberately excluded in the v0.1 product spec. Listing them only so
the line is clear; they belong to a different product than this lab:

- Auth / accounts / multi-user, payments, public API.
- Cloud file storage, deployment, background workers, queues, batch processing.
- A finalized, hard-coded "official" surf rubric or scientific benchmark.
- FFmpeg / server-side video processing.

---

_Suggested next picks_ if you want the highest value for the least effort:
**click-to-seek timestamps** (§2), **re-run exact config** + **delete run**
(§1/§4), **token usage** (§3), and **CI + LICENSE** (§5) before sharing widely.
