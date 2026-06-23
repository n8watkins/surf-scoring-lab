import { test } from "node:test";
import assert from "node:assert/strict";
// Use an explicit relative path with extension so this runs under plain
// `node --test` (Node strips the TypeScript types; no build step needed).
import { extractJsonCandidate, parseModelResponse, safeParseJson } from "./json.ts";

test("safeParseJson reports the parser error message", () => {
  const result = safeParseJson("{ not json ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /./);
});

test("extractJsonCandidate returns raw object text unchanged", () => {
  assert.equal(extractJsonCandidate('  {"a":1}  '), '{"a":1}');
});

test("extractJsonCandidate unwraps a single ```json fence", () => {
  const fenced = "```json\n{\n  \"a\": 1\n}\n```";
  assert.equal(extractJsonCandidate(fenced), '{\n  "a": 1\n}');
});

test("extractJsonCandidate unwraps an unlabeled fence", () => {
  assert.equal(extractJsonCandidate("```\n[1,2,3]\n```"), "[1,2,3]");
});

test("extractJsonCandidate does NOT slice prose around invalid json", () => {
  // We deliberately avoid aggressive repair: leading prose stays, so this
  // remains invalid rather than being silently "fixed".
  const text = "Here is your result: {\"a\":1} thanks!";
  assert.equal(extractJsonCandidate(text), text);
});

test("parseModelResponse: valid direct json", () => {
  const r = parseModelResponse('{"gradable":true,"score":7}');
  assert.equal(r.parseStatus, "valid_json");
  assert.deepEqual(r.value, { gradable: true, score: 7 });
});

test("parseModelResponse: valid fenced json", () => {
  const r = parseModelResponse("```json\n{\"score\":9}\n```");
  assert.equal(r.parseStatus, "valid_json");
  assert.deepEqual(r.value, { score: 9 });
});

test("parseModelResponse: empty response", () => {
  assert.equal(parseModelResponse("").parseStatus, "empty_response");
  assert.equal(parseModelResponse("   ").parseStatus, "empty_response");
  assert.equal(parseModelResponse(null).parseStatus, "empty_response");
});

test("parseModelResponse: invalid json is preserved, not faked", () => {
  const r = parseModelResponse("Sorry, I cannot analyze this video.");
  assert.equal(r.parseStatus, "invalid_json");
  assert.equal(r.value, null);
  assert.notEqual(r.error, null);
});
