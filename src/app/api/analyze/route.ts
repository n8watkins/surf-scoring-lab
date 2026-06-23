import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { createPartFromText, createPartFromUri } from "@google/genai";
import { z } from "zod";
import { getAppState, getVideo, insertRun } from "@/lib/db";
import {
  deleteGeminiFile,
  getGeminiClient,
  toPublicError,
  waitForActiveFile,
} from "@/lib/gemini";
import { parseModelResponse, safeParseJson } from "@/lib/json";
import { buildInstruction } from "@/lib/prompt-assembly";
import { getApiKey } from "@/lib/settings";
import { LOCKED_MODEL } from "@/lib/starters";
import type { ParseStatus, RunStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const analyzeSchema = z.object({
  videoId: z.string().min(1),
  model: z.literal(LOCKED_MODEL),
  promptName: z.string().trim().min(1).max(120),
  prompt: z.string().min(1),
  promptVersionId: z.string().nullable().optional(),
  promptVersionNumber: z.number().int().nullable().optional(),
  rubricName: z.string().trim().min(1).max(120),
  rubric: z.string().min(1),
  rubricVersionId: z.string().nullable().optional(),
  rubricVersionNumber: z.number().int().nullable().optional(),
  outputFormatName: z.string().trim().min(1).max(120),
  outputFormatMode: z.enum(["example", "schema"]),
  outputFormat: z.string().min(1),
  outputFormatVersionId: z.string().nullable().optional(),
  outputFormatVersionNumber: z.number().int().nullable().optional(),
  hypothesis: z.string().max(2000).optional().nullable(),
  outcomeNote: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  const parsed = analyzeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Analyze request is incomplete.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API key is configured. Open Settings to add one." },
      { status: 400 },
    );
  }

  const outputJson = safeParseJson(data.outputFormat);
  if (!outputJson.ok) {
    return NextResponse.json(
      { error: `Output format is not valid JSON: ${outputJson.error}` },
      { status: 400 },
    );
  }

  const video = getVideo(data.videoId);
  if (!video || !existsSync(video.localPath)) {
    return NextResponse.json(
      { error: "The selected video could not be found locally." },
      { status: 404 },
    );
  }

  const assembledRequest = buildInstruction({
    prompt: data.prompt,
    rubric: data.rubric,
    outputFormat: data.outputFormat,
    outputFormatMode: data.outputFormatMode,
  });

  const ai = getGeminiClient(apiKey);
  const startedAt = performance.now();

  let rawResponse: string | null = null;
  let parsedResponse: unknown | null = null;
  let parseStatus: ParseStatus = "not_attempted";
  let status: RunStatus = "api_error";
  let errorMessage: string | null = null;
  let uploadedFileName: string | undefined;

  try {
    // --- Upload phase -----------------------------------------------------
    let activeUri: string;
    let activeMime: string;
    try {
      const uploaded = await ai.files.upload({
        file: video.localPath,
        config: { mimeType: "video/mp4", displayName: video.name },
      });
      uploadedFileName = uploaded.name;
      const active = await waitForActiveFile(ai, uploaded);
      if (!active.uri) throw new Error("Gemini did not return a file URI for the video.");
      activeUri = active.uri;
      activeMime = active.mimeType ?? "video/mp4";
    } catch (uploadError) {
      status = "upload_error";
      errorMessage = toPublicError(uploadError);
      throw new Error("__handled__");
    }

    // --- Generation phase -------------------------------------------------
    const response = await ai.models.generateContent({
      model: data.model,
      contents: [
        {
          role: "user",
          parts: [createPartFromUri(activeUri, activeMime), createPartFromText(assembledRequest)],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    rawResponse = response.text ?? "";
    const result = parseModelResponse(rawResponse);
    parseStatus = result.parseStatus;

    if (result.parseStatus === "valid_json") {
      parsedResponse = result.value;
      status = "success";
    } else {
      status = "response_parse_error";
      errorMessage =
        result.parseStatus === "empty_response"
          ? "Gemini returned an empty response."
          : `Gemini responded, but the text was not valid JSON: ${result.error ?? "parse failed"}`;
    }
  } catch (error) {
    if (!(error instanceof Error && error.message === "__handled__")) {
      status = "api_error";
      errorMessage = toPublicError(error);
    }
  } finally {
    await deleteGeminiFile(ai, uploadedFileName);
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const run = insertRun({
    videoId: video.id,
    model: data.model,
    promptVersionId: data.promptVersionId ?? null,
    promptVersionNumber: data.promptVersionNumber ?? null,
    promptName: data.promptName,
    promptSnapshot: data.prompt,
    rubricVersionId: data.rubricVersionId ?? null,
    rubricVersionNumber: data.rubricVersionNumber ?? null,
    rubricName: data.rubricName,
    rubricSnapshot: data.rubric,
    outputFormatVersionId: data.outputFormatVersionId ?? null,
    outputFormatVersionNumber: data.outputFormatVersionNumber ?? null,
    outputFormatName: data.outputFormatName,
    outputFormatMode: data.outputFormatMode,
    outputFormatSnapshot: data.outputFormat,
    assembledRequest,
    rawResponse,
    parsedResponse,
    parseStatus,
    status,
    errorMessage,
    latencyMs,
    hypothesis: data.hypothesis?.trim() || null,
    outcomeNote: data.outcomeNote?.trim() || null,
  });

  return NextResponse.json({ run, state: getAppState() }, { status: 200 });
}
