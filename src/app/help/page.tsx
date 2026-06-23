import Link from "next/link";
import { ArrowLeft, Braces, FileText, ListChecks } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · Surf Scoring Lab",
};

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-teal-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-white">How Surf Scoring Lab works</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This is a <strong className="text-zinc-200">lab for experimenting</strong>, not an official
            judging system. The goal is to find out how well Gemini grades a short surf clip when{" "}
            <em>you</em> control the instructions, the criteria, and the answer format — and to compare
            different attempts side by side. Nothing here claims a single &ldquo;correct&rdquo; rubric or
            score.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">The three ingredients you control</h2>
          <p className="text-sm leading-6 text-zinc-400">
            Every analysis sends Gemini one video plus three <em>separate</em> pieces of text. They live
            under <strong className="text-zinc-200">Experiment setup</strong> on the dashboard, each on
            its own tab, and each can be saved and versioned independently:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Ingredient
              icon={<FileText className="h-4 w-4" />}
              title="Prompt"
              body="Your instructions to the model: what to look at, what not to guess, how to score or abstain, whether to cite timestamps."
            />
            <Ingredient
              icon={<ListChecks className="h-4 w-4" />}
              title="Rubric"
              body="Your grading criteria — the categories and scoring scale. This is the standard you're judging against; there's no single right one."
            />
            <Ingredient
              icon={<Braces className="h-4 w-4" />}
              title="Output JSON"
              body="An example of the JSON shape you want back. It guides the structure of the answer (it doesn't guarantee it)."
            />
          </div>
          <p className="text-sm leading-6 text-zinc-400">
            Keeping them separate is the whole point: you can change just the <strong className="text-zinc-200">rubric</strong>{" "}
            while leaving the prompt and output the same, run it again, and see exactly what that one
            change did.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">The loop</h2>
          <ol className="space-y-3">
            <Step n={1} title="Add your Gemini API key">
              Top-right of the dashboard. It&apos;s stored locally on your machine and used only on the
              server — never committed or shared. Each person running the app brings their own key.
            </Step>
            <Step n={2} title="Upload a clip">
              Drag in one MP4 (MP4 only, up to 50&nbsp;MB). For the clearest first results: one surfer,
              one ride, one continuous clip, under 30&nbsp;seconds. Selecting a clip does{" "}
              <strong className="text-zinc-200">not</strong> send it anywhere yet.
            </Step>
            <Step n={3} title="Open “Experiment setup” and tune the three ingredients">
              This panel is collapsed by default. Open it to edit the Prompt, Rubric, and Output JSON
              tabs. Use <strong className="text-zinc-200">Save new … version</strong> on any tab to keep a
              named, immutable version you can reload later. You can also analyze with unsaved edits.
            </Step>
            <Step n={4} title="Click Analyze video">
              This is the only moment Gemini is contacted. The button stays disabled until you have a key,
              a clip, and valid Output JSON.
            </Step>
            <Step n={5} title="Read the grade">
              The result card shows the score (color-coded), whether the clip was gradable, a readable
              rendering of the response, the exact raw text, and the full request that was sent.
            </Step>
            <Step n={6} title="Compare and iterate">
              Every run is saved under <strong className="text-zinc-200">Previous grades</strong> with its
              score. Reopen a run with its exact inputs, duplicate it to change one variable, add an
              outcome note, select two runs to compare side by side, or export to JSON/CSV.
            </Step>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Why runs are reproducible</h2>
          <p className="text-sm leading-6 text-zinc-400">
            Each run stores an immutable <em>snapshot</em> of the exact prompt, rubric, output format, and
            assembled request that was sent. Editing or deleting a version later never changes a past run,
            so your history stays trustworthy as you experiment.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Good first experiments</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-400">
            <li>Run the same clip twice, changing only the rubric, and compare the two grades.</li>
            <li>Ask the prompt to cite timestamps, then check whether the evidence lines up with the video.</li>
            <li>Try a no-score coaching rubric vs. a numeric one to see which is more useful to you.</li>
            <li>Add a hypothesis before each run, then an outcome note after — your notes show up in history.</li>
          </ul>
        </section>

        <div className="border-t border-zinc-800 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-teal-300 transition hover:text-teal-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function Ingredient({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-300">
        {icon}
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-zinc-400">{body}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-sm font-semibold text-teal-300">
        {n}
      </span>
      <div>
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <p className="mt-0.5 text-sm leading-6 text-zinc-400">{children}</p>
      </div>
    </li>
  );
}
