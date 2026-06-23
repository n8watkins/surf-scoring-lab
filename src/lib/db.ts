import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  AppStatePayload,
  ExperimentRun,
  OutputFormatVersionRecord,
  OutputMode,
  ParseStatus,
  PublicVideo,
  RunStatus,
  VersionRecord,
  VideoRecord,
} from "@/lib/types";
import { outputPresets, rubricPresets, starterPrompt } from "@/lib/starters";
import { getKeyStatus } from "@/lib/settings";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "surf-scoring-lab.sqlite");

let db: DatabaseSync | null = null;

type Row = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

function parseStoredJson(value: unknown): unknown | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getDb() {
  if (db) return db;

  mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      localPath TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      duration REAL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rubric_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS output_format_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  migrateRunsTable(db);
  seedDefaults(db);
  return db;
}

/**
 * The run table stores immutable snapshots so old runs stay reproducible. An
 * earlier schema joined to version tables instead; if we detect that shape (or
 * none), we recreate the table. Runs hold no irreplaceable data and the table
 * is empty on fresh installs, so this is safe and non-destructive to videos /
 * versions / settings.
 */
function migrateRunsTable(database: DatabaseSync) {
  const columns = database.prepare("PRAGMA table_info(experiment_runs)").all() as Row[];
  const hasSnapshot = columns.some((c) => asString(c.name) === "promptSnapshot");
  if (columns.length > 0 && !hasSnapshot) {
    database.exec("DROP TABLE experiment_runs;");
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS experiment_runs (
      id TEXT PRIMARY KEY,
      runNumber INTEGER NOT NULL,
      videoId TEXT NOT NULL REFERENCES videos(id),
      model TEXT NOT NULL,

      promptVersionId TEXT,
      promptVersionNumber INTEGER,
      promptName TEXT NOT NULL,
      promptSnapshot TEXT NOT NULL,

      rubricVersionId TEXT,
      rubricVersionNumber INTEGER,
      rubricName TEXT NOT NULL,
      rubricSnapshot TEXT NOT NULL,

      outputFormatVersionId TEXT,
      outputFormatVersionNumber INTEGER,
      outputFormatName TEXT NOT NULL,
      outputFormatMode TEXT NOT NULL,
      outputFormatSnapshot TEXT NOT NULL,

      assembledRequest TEXT NOT NULL,

      rawResponse TEXT,
      parsedResponse TEXT,
      parseStatus TEXT NOT NULL,
      status TEXT NOT NULL,
      errorMessage TEXT,

      latencyMs INTEGER,
      hypothesis TEXT,
      outcomeNote TEXT,

      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}

function seedDefaults(database: DatabaseSync) {
  const promptCount = asNumber(
    database.prepare("SELECT COUNT(*) AS count FROM prompt_versions").get()?.count,
  );
  if (promptCount === 0) {
    insertVersion("prompt_versions", "Starter prompt", starterPrompt);
  }

  const rubricCount = asNumber(
    database.prepare("SELECT COUNT(*) AS count FROM rubric_versions").get()?.count,
  );
  if (rubricCount === 0) {
    for (const preset of rubricPresets) {
      insertVersion("rubric_versions", preset.name, preset.content);
    }
  }

  const outputCount = asNumber(
    database.prepare("SELECT COUNT(*) AS count FROM output_format_versions").get()?.count,
  );
  if (outputCount === 0) {
    for (const preset of outputPresets) {
      insertOutputFormatVersion(preset.name, preset.mode, preset.content);
    }
  }
}

// ---------------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------------

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? asNullableString(row.value) : null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    )
    .run(key, value, nowIso());
}

export function deleteSetting(key: string) {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

function nextVersion(tableName: string, name: string) {
  const row = getDb()
    .prepare(`SELECT COALESCE(MAX(version), 0) + 1 AS version FROM ${tableName} WHERE name = ?`)
    .get(name);
  return asNumber(row?.version) || 1;
}

export function insertVersion(
  tableName: "prompt_versions" | "rubric_versions",
  name: string,
  content: string,
): VersionRecord {
  const id = randomUUID();
  const version = nextVersion(tableName, name);
  const createdAt = nowIso();

  getDb()
    .prepare(
      `INSERT INTO ${tableName} (id, name, content, version, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, name, content, version, createdAt);

  return { id, name, content, version, createdAt };
}

export function insertOutputFormatVersion(
  name: string,
  mode: OutputMode,
  content: string,
): OutputFormatVersionRecord {
  const id = randomUUID();
  const version = nextVersion("output_format_versions", name);
  const createdAt = nowIso();

  getDb()
    .prepare(
      `INSERT INTO output_format_versions (id, name, mode, content, version, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, name, mode, content, version, createdAt);

  return { id, name, mode, content, version, createdAt };
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export function insertVideo(input: {
  name: string;
  filename: string;
  localPath: string;
  fileSize: number;
  duration: number | null;
}): VideoRecord {
  const id = randomUUID();
  const createdAt = nowIso();

  getDb()
    .prepare(
      `INSERT INTO videos (id, name, filename, localPath, fileSize, duration, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.name, input.filename, input.localPath, input.fileSize, input.duration, createdAt);

  return { id, ...input, createdAt };
}

export function getVideo(id: string): VideoRecord | null {
  const row = getDb().prepare("SELECT * FROM videos WHERE id = ?").get(id);
  if (!row) return null;
  return rowToVideo(row);
}

/** Strip the server-only filesystem path before sending a video to the client. */
export function toPublicVideo(video: VideoRecord): PublicVideo {
  const { localPath: _localPath, ...rest } = video;
  void _localPath;
  return rest;
}

/** A video can only be deleted when no run references it. Returns false if in use. */
export function deleteVideo(id: string): boolean {
  const inUse = asNumber(
    getDb().prepare("SELECT COUNT(*) AS count FROM experiment_runs WHERE videoId = ?").get(id)?.count,
  );
  if (inUse > 0) return false;
  getDb().prepare("DELETE FROM videos WHERE id = ?").run(id);
  return true;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export type InsertRunInput = {
  videoId: string;
  model: string;
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
};

export function insertRun(input: InsertRunInput): ExperimentRun {
  const row = getDb()
    .prepare("SELECT COALESCE(MAX(runNumber), 0) + 1 AS runNumber FROM experiment_runs")
    .get();
  const runNumber = asNumber(row?.runNumber) || 1;
  const id = randomUUID();
  const createdAt = nowIso();

  getDb()
    .prepare(
      `INSERT INTO experiment_runs (
        id, runNumber, videoId, model,
        promptVersionId, promptVersionNumber, promptName, promptSnapshot,
        rubricVersionId, rubricVersionNumber, rubricName, rubricSnapshot,
        outputFormatVersionId, outputFormatVersionNumber, outputFormatName,
        outputFormatMode, outputFormatSnapshot,
        assembledRequest, rawResponse, parsedResponse, parseStatus, status, errorMessage,
        latencyMs, hypothesis, outcomeNote, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      runNumber,
      input.videoId,
      input.model,
      input.promptVersionId,
      input.promptVersionNumber,
      input.promptName,
      input.promptSnapshot,
      input.rubricVersionId,
      input.rubricVersionNumber,
      input.rubricName,
      input.rubricSnapshot,
      input.outputFormatVersionId,
      input.outputFormatVersionNumber,
      input.outputFormatName,
      input.outputFormatMode,
      input.outputFormatSnapshot,
      input.assembledRequest,
      input.rawResponse,
      input.parsedResponse === null ? null : JSON.stringify(input.parsedResponse),
      input.parseStatus,
      input.status,
      input.errorMessage,
      input.latencyMs,
      input.hypothesis,
      input.outcomeNote,
      createdAt,
      createdAt,
    );

  return getRun(id)!;
}

export function getRun(id: string): ExperimentRun | null {
  const row = getDb()
    .prepare(
      `SELECT er.*, v.name AS videoName
       FROM experiment_runs er
       JOIN videos v ON v.id = er.videoId
       WHERE er.id = ?`,
    )
    .get(id);
  return row ? rowToRun(row) : null;
}

/** Update the post-run outcome note (PRD: "add an outcome note after reviewing"). */
export function updateRunOutcomeNote(id: string, outcomeNote: string | null): ExperimentRun | null {
  const exists = getDb().prepare("SELECT id FROM experiment_runs WHERE id = ?").get(id);
  if (!exists) return null;
  getDb()
    .prepare("UPDATE experiment_runs SET outcomeNote = ?, updatedAt = ? WHERE id = ?")
    .run(outcomeNote, nowIso(), id);
  return getRun(id);
}

// ---------------------------------------------------------------------------
// Aggregate state
// ---------------------------------------------------------------------------

export function getAppState(): AppStatePayload {
  const database = getDb();

  return {
    videos: database
      .prepare("SELECT * FROM videos ORDER BY createdAt DESC")
      .all()
      .map(rowToVideo)
      .map(toPublicVideo),
    prompts: database
      .prepare("SELECT * FROM prompt_versions ORDER BY name ASC, version DESC")
      .all()
      .map(rowToVersion),
    rubrics: database
      .prepare("SELECT * FROM rubric_versions ORDER BY name ASC, version DESC")
      .all()
      .map(rowToVersion),
    outputFormats: database
      .prepare("SELECT * FROM output_format_versions ORDER BY name ASC, version DESC")
      .all()
      .map(rowToOutputFormatVersion),
    runs: database
      .prepare(
        `SELECT er.*, v.name AS videoName
         FROM experiment_runs er
         JOIN videos v ON v.id = er.videoId
         ORDER BY er.runNumber DESC LIMIT 100`,
      )
      .all()
      .map(rowToRun),
    key: getKeyStatus(),
  };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToVideo(row: Row): VideoRecord {
  return {
    id: asString(row.id),
    name: asString(row.name),
    filename: asString(row.filename),
    localPath: asString(row.localPath),
    fileSize: asNumber(row.fileSize),
    duration: asNullableNumber(row.duration),
    createdAt: asString(row.createdAt),
  };
}

function rowToVersion(row: Row): VersionRecord {
  return {
    id: asString(row.id),
    name: asString(row.name),
    content: asString(row.content),
    version: asNumber(row.version),
    createdAt: asString(row.createdAt),
  };
}

function rowToOutputFormatVersion(row: Row): OutputFormatVersionRecord {
  return {
    ...rowToVersion(row),
    mode: asMode(),
  };
}

function asMode(): OutputMode {
  // Only "example" is supported in v0.1; any stored value normalizes to it.
  return "example";
}

function asRunStatus(value: unknown): RunStatus {
  if (
    value === "success" ||
    value === "response_parse_error" ||
    value === "api_error" ||
    value === "upload_error"
  ) {
    return value;
  }
  return "api_error";
}

function asParseStatus(value: unknown): ParseStatus {
  if (
    value === "valid_json" ||
    value === "invalid_json" ||
    value === "empty_response" ||
    value === "not_attempted"
  ) {
    return value;
  }
  return "not_attempted";
}

function rowToRun(row: Row): ExperimentRun {
  return {
    id: asString(row.id),
    runNumber: asNumber(row.runNumber),
    videoId: asString(row.videoId),
    videoName: asString(row.videoName),
    model: asString(row.model),

    promptVersionId: asNullableString(row.promptVersionId),
    promptVersionNumber: asNullableNumber(row.promptVersionNumber),
    promptName: asString(row.promptName),
    promptSnapshot: asString(row.promptSnapshot),

    rubricVersionId: asNullableString(row.rubricVersionId),
    rubricVersionNumber: asNullableNumber(row.rubricVersionNumber),
    rubricName: asString(row.rubricName),
    rubricSnapshot: asString(row.rubricSnapshot),

    outputFormatVersionId: asNullableString(row.outputFormatVersionId),
    outputFormatVersionNumber: asNullableNumber(row.outputFormatVersionNumber),
    outputFormatName: asString(row.outputFormatName),
    outputFormatMode: asMode(),
    outputFormatSnapshot: asString(row.outputFormatSnapshot),

    assembledRequest: asString(row.assembledRequest),

    rawResponse: asNullableString(row.rawResponse),
    parsedResponse: parseStoredJson(row.parsedResponse),
    parseStatus: asParseStatus(row.parseStatus),
    status: asRunStatus(row.status),
    errorMessage: asNullableString(row.errorMessage),

    latencyMs: asNullableNumber(row.latencyMs),
    hypothesis: asNullableString(row.hypothesis),
    outcomeNote: asNullableString(row.outcomeNote),

    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
  };
}
