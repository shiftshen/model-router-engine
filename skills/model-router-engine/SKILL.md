---
name: model-router-engine
description: Recommend a qualified model for a structured task profile using Model Router Engine's local Laya primary and Jev fallback. Use when an agent needs model selection guidance; recommendations are advisory and do not change the active model.
---

# Model Router Engine

Use this skill when choosing among explicitly qualified model candidates would help with the current task. Keep the task description structured: send task type, difficulty, required capabilities, modalities, languages, context/output needs, and privacy requirements. Do not include the user's prompt, source text, credentials, or private project data.

Run the engine's `recommend` command with one JSON object on standard input:

```json
{
  "profile": {
    "taskType": "coding",
    "difficulty": "medium",
    "requiredCapabilities": ["coding"],
    "modalities": ["text"],
    "languages": ["en"],
    "contextRequirement": 12000,
    "outputRequirement": 3000,
    "privacy": "local_required"
  },
  "candidates": [
    {
      "id": "local-coder",
      "modelId": "local-coder-v1",
      "provider": "local",
      "capabilities": ["coding"],
      "modalities": ["text"],
      "languages": ["en"],
      "contextWindow": 32000,
      "maxOutput": 8000,
      "costTier": 1,
      "latencyTier": 2,
      "privacy": "local",
      "status": "qualified",
      "credentialStatus": "active"
    }
  ]
}
```

Invoke the installed local Skill wrapper (the local installation links it to the engine checkout):

```sh
node "$HOME/.codex/skills/model-router-engine/scripts/recommend.mjs" < request.json
```

For another checkout, set `MODEL_ROUTER_ENGINE_HOME` to that checkout; this setting overrides the local link.

When running from the engine checkout, its repository copy also works with the checkout as the default engine root:

```sh
node skills/model-router-engine/scripts/recommend.mjs < request.json
```

The command runs locally and prints a JSON result. The host, not the engine, establishes candidate qualification, capability claims, credential availability, and policy eligibility. Include only candidates the host has explicitly qualified and can actually invoke; never infer qualification from a model name.

## Automatic task assignment

When the user or calling workflow allows automatic assignment, use the recommendation to dispatch work:

1. Build a structured profile from task type, difficulty, required capabilities, modalities, languages, context/output needs, and privacy. Send only that profile and the host-qualified candidate list to the engine; never send the original prompt, source text, keys, or private project data.
2. Run `recommend` and inspect the JSON. Continue only when `status` equals `"resolved"` and `selected.id` exactly matches an `id` in the submitted candidate list. Otherwise, do not dispatch; report that no qualified selection was resolved.
3. Use the available subagent/worker tool to start the task with the exact selected candidate's model, and verify the returned worker is actually configured for that model before relying on it. If the host cannot launch that model, stop and report the limitation.
4. Review the delegated result against the task requirements before reporting completion.

Prefer a qualified rule-based recommendation for simple tasks. For complex tasks, use Laya first and Jev only through the engine's fallback when Laya cannot resolve confidently. This skill cannot change the model of the already-running Codex turn: automatic assignment means dispatching a new worker when the host supports it, not silently switching the current turn. Without explicit permission for automatic assignment or a usable worker tool, present the recommendation as advisory and leave execution to the caller.

Never place API keys in task JSON or output.
