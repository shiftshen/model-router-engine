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

The command runs locally and prints a JSON advisory result. Treat `selected` as a suggestion only; explain its provenance and limitations, and keep the current model unless the user or caller explicitly authorizes a switch. A missing or rejected recommendation means there is no safe qualified match. The engine may use local Laya CoreML when configured and use Jev as fallback; `doctor` reports local setup needs. Never place API keys in task JSON or output.
