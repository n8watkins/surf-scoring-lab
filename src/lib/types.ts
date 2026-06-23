// v0.1 supports the JSON-example approach only. The `mode` column is kept for
// forward-compatibility (a future JSON-Schema mode), but "example" is the only
// value the app currently produces or sends.
export type OutputMode = "example";

/**
 * Overall fate of an experiment run.
 * - success            : Gemini responded and the response parsed as JSON.
 * - response_parse_error : Gemini responded but the text was not valid JSON.
 * - api_error          : the Gemini request itself failed.
 * - upload_error       : the video could not be sent to Gemini.
 */
export type RunStatus =
  | "success"
  | "response_parse_error"
  | "api_error"
  | "upload_error";

/** Result of trying to parse Gemini's raw text as JSON. */
export type ParseStatus =
  | "not_attempted"
  | "valid_json"
  | "invalid_json"
  | "empty_response";

export type VideoRecord = {
  id: string;
  name: string;
  filename: string;
  localPath: string;
  fileSize: number;
  duration: number | null;
  createdAt: string;
};

/** Client-facing video: the server-only filesystem path is never sent. */
export type PublicVideo = Omit<VideoRecord, "localPath">;

export type VersionRecord = {
  id: string;
  name: string;
  content: string;
  version: number;
  createdAt: string;
};

export type OutputFormatVersionRecord = VersionRecord & {
  mode: OutputMode;
};

/**
 * A single experiment run. Every run stores an immutable *snapshot* of the
 * exact prompt / rubric / output format and the assembled request that was
 * sent to Gemini, so a past run stays reproducible even if the underlying
 * version records or presets are later changed or deleted.
 */
export type ExperimentRun = {
  id: string;
  runNumber: number;
  videoId: string;
  videoName: string;
  model: string;

  // Provenance (nullable: a run can use unsaved editor content).
  promptVersionId: string | null;
  promptVersionNumber: number | null;
  promptName: string;
  promptSnapshot: string;

  rubricVersionId: string | null;
  rubricVersionNumber: number | null;
  rubricName: string;
  rubricSnapshot: string;

  outputFormatVersionId: string | null;
  outputFormatVersionNumber: number | null;
  outputFormatName: string;
  outputFormatMode: OutputMode;
  outputFormatSnapshot: string;

  assembledRequest: string;

  rawResponse: string | null;
  parsedResponse: unknown | null;
  parseStatus: ParseStatus;
  status: RunStatus;
  errorMessage: string | null;

  latencyMs: number | null;
  hypothesis: string | null;
  outcomeNote: string | null;

  createdAt: string;
  updatedAt: string;
};

export type KeyStatus = {
  configured: boolean;
  /** Last 4 characters of the configured key, for confirmation only. Never the full key. */
  hint: string | null;
  /** Whether the key comes from the GEMINI_API_KEY env var rather than the in-app store. */
  fromEnv: boolean;
};

export type AppStatePayload = {
  videos: PublicVideo[];
  prompts: VersionRecord[];
  rubrics: VersionRecord[];
  outputFormats: OutputFormatVersionRecord[];
  runs: ExperimentRun[];
  key: KeyStatus;
};
