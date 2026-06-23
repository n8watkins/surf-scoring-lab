export type AssemblyInput = {
  prompt: string;
  rubric: string;
  outputFormat: string;
};

/**
 * Assemble the single text instruction that accompanies the video.
 *
 * The exact string returned here is persisted on every run as
 * `assembledRequest`, so the user can always inspect precisely what was sent.
 */
export function buildInstruction(input: AssemblyInput): string {
  const formatLabel =
    "Return JSON shaped like this example. Preserve the intended field names and overall structure.";

  return `${input.prompt.trim()}

User-editable surfing rubric:
${input.rubric.trim()}

Requested output format:
${formatLabel}

${input.outputFormat.trim()}

Return only JSON. Do not wrap the response in Markdown fences. If the video cannot be judged reliably, set "gradable" to false when that field exists and explain why in the closest matching field.`;
}
