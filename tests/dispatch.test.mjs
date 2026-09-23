import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { dispatch } from "../src/dispatch.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const input = JSON.parse(readFileSync(join(root, "examples/recommend.json"), "utf8"));
const selected = { id: "example-coder", modelId: "model-coder", provider: "example-provider", status: "qualified", fallback: false };
const recommendation = { status: "resolved", source: "rules", selected, provenance: { selectedBy: "rules" } };

test("dispatch recommends and invokes the verified host executor exactly once", async () => {
  let recommended = 0;
  let executed = 0;
  const result = await dispatch(input, {
    recommend: async () => { recommended += 1; return recommendation; },
    execute: async (model, context) => {
      executed += 1;
      assert.deepEqual(model, { id: "example-coder", modelId: "model-coder", provider: "example-provider" });
      assert.equal(context.profile.taskType, "coding");
      return { jobId: "job-1" };
    },
  });
  assert.equal(recommended, 1);
  assert.equal(executed, 1);
  assert.equal(result.decision.status, "selected");
  assert.equal(result.execution.status, "completed");
  assert.deepEqual(result.execution.result, { jobId: "job-1" });
});

test("the default recommender can dispatch a simple task", async () => {
  let executed = 0;
  const result = await dispatch(input, { execute: async () => { executed += 1; return "ok"; } });
  assert.equal(executed, 1);
  assert.equal(result.execution.result, "ok");
});

test("unresolved recommendation and invalid input never invoke the executor", async () => {
  let executed = 0;
  const execute = () => { executed += 1; };
  const unavailable = await dispatch(input, { recommendation: { status: "profile_unavailable", selected: null }, execute });
  const invalid = await dispatch({ ...input, prompt: "private" }, { recommendation, execute });
  assert.equal(unavailable.decision.reason, "no_resolved_selection");
  assert.equal(invalid.decision.reason, "invalid_request");
  assert.equal(unavailable.execution.status, "skipped");
  assert.equal(invalid.execution.status, "skipped");
  assert.equal(executed, 0);
});

test("route, provider and actual model identity mismatches are rejected", async () => {
  let executed = 0;
  for (const change of [{ id: "other" }, { provider: "other" }, { modelId: "other" }]) {
    const result = await dispatch(input, {
      recommendation: { ...recommendation, selected: { ...selected, ...change } },
      execute: () => { executed += 1; },
    });
    assert.equal(result.decision.reason, "selection_identity_mismatch");
    assert.equal(result.execution.status, "skipped");
  }
  assert.equal(executed, 0);
});

test("non-qualified selection is rejected even when a recommendation claims resolved", async () => {
  let executed = 0;
  const result = await dispatch({ ...input, candidates: [{ ...input.candidates[0], status: "manual_only" }] }, {
    recommendation,
    execute: () => { executed += 1; },
  });
  assert.equal(result.decision.reason, "selection_not_qualified");
  assert.equal(executed, 0);
});

test("a forged resolved selection cannot bypass task capability requirements", async () => {
  let executed = 0;
  const result = await dispatch({ ...input, candidates: [{ ...input.candidates[0], capabilities: ["translation"] }] }, {
    recommendation,
    execute: () => { executed += 1; },
  });
  assert.equal(result.decision.reason, "selection_not_qualified");
  assert.equal(executed, 0);
});

test("executor failure returns a failure state without exposing exception details", async () => {
  const result = await dispatch(input, {
    recommendation,
    execute: () => { throw new Error("private credential text"); },
  });
  assert.equal(result.decision.status, "selected");
  assert.deepEqual(result.execution, { status: "failed", reason: "executor_failed" });
  assert.doesNotMatch(JSON.stringify(result), /private credential text/);
});
