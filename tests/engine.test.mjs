import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildRegistry, compare, recommend } from "../src/engine.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const example = JSON.parse(readFileSync(join(root, "examples/recommend.json"), "utf8"));
const single = (profile) => ({ task_type: profile.taskType, difficulty: profile.difficulty, required_capabilities: profile.requiredCapabilities, modalities: profile.modalities, languages: profile.languages, context_requirement: profile.contextRequirement ?? 0, output_requirement: profile.outputRequirement ?? 0, privacy: profile.privacy, quality_priority: "high", cost_priority: "medium", latency_priority: "medium", needs_multi_agent: false, roles: [] });

test("advisory result retains caller route id and actual model id", async () => {
  const result = await recommend(example, { clients: { layaClient: null, jevClient: null } });
  assert.equal(result.mode, "advisory");
  assert.equal(result.status, "resolved");
  assert.equal(result.selected.id, "example-coder");
  assert.equal(result.selected.modelId, "model-coder");
  assert.equal(result.provenance.selectedBy, "rules");
});

test("unconfigured hard task fails closed with no selected model", async () => {
  const result = await recommend({ ...example, profile: { ...example.profile, difficulty: "hard" } }, { clients: { layaClient: null, jevClient: null } });
  assert.equal(result.status, "profile_unavailable");
  assert.equal(result.selected, null);
});

test("Laya is primary and Jev is used after low confidence", async () => {
  const request = { ...example, profile: { ...example.profile, difficulty: "hard" } };
  let jevCalls = 0;
  const result = await recommend(request, { clients: {
    layaClient: { async profileTask(profile) { return { profile: single(profile), confidence: 0.3 }; } },
    jevClient: { async profileTask(profile) { jevCalls += 1; return single(profile); } },
  } });
  assert.equal(result.status, "resolved");
  assert.equal(result.source, "jev");
  assert.equal(result.provenance.primary, "laya_typed");
  assert.equal(result.provenance.fallbackReason, "laya_low_confidence");
  assert.equal(jevCalls, 1);
});

test("unknown fields and missing explicit qualification are rejected before runtime", async () => {
  assert.throws(() => buildRegistry({ ...example, prompt: "secret" }), /unsupported field: prompt/);
  assert.throws(() => buildRegistry({ ...example, profile: { ...example.profile, apiKey: "secret" } }), /unsupported field: apiKey/);
  assert.throws(() => buildRegistry({ ...example, candidates: [{ ...example.candidates[0], token: "secret" }] }), /unsupported field: token/);
  assert.throws(() => buildRegistry({ ...example, candidates: [{ ...example.candidates[0], status: undefined }] }), /requires explicit status/);
  assert.throws(() => buildRegistry({ ...example, candidates: [{ ...example.candidates[0], credentialStatus: undefined }] }), /requires explicit status/);
});

test("comparison reports independent branches and elapsed time without claiming accuracy", async () => {
  const profile = { ...example.profile, difficulty: "hard" };
  let tick = 0;
  const result = await compare({ cases: [{ id: "coding", profile, candidates: example.candidates }] }, { now: () => ++tick, clients: {
    layaClient: { async profileTask(value) { return { profile: single(value), confidence: 0.2 }; } },
    jevClient: { async profileTask(value) { return single(value); } },
  } });
  const row = result.cases[0];
  assert.equal(row.laya_only.status, "profile_unavailable");
  assert.equal(row.jev_only.status, "resolved");
  assert.equal(row.laya_then_jev.provenance.selectedBy, "jev_fallback");
  assert.equal(row.laya_then_jev.elapsedMs, 1);
});

test("CLI reads JSON stdin, returns one advisory JSON result and sanitizes invalid input", () => {
  const bin = join(root, "bin/model-router-engine.mjs");
  const ok = spawnSync(process.execPath, [bin, "recommend"], { input: JSON.stringify(example), encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).selected.modelId, "model-coder");
  const bad = spawnSync(process.execPath, [bin, "recommend"], { input: JSON.stringify({ ...example, prompt: "private task" }), encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.equal(JSON.parse(bad.stdout).error, "invalid_input");
  assert.doesNotMatch(bad.stdout, /private task/);
});
