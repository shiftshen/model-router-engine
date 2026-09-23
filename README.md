# Model Router Engine

独立运行的模型路由建议引擎。输入经调用方验证的任务约束与候选模型能力，返回建议和来源；**不会调用候选模型、修改 Codex 配置或自动切换模型**。复杂任务先用本地 Laya Typed-Decisions 作有限选项判断；置信度低、出错或超时后由 Jev 选择安全的路由模板。简单任务直接走规则。

## 快速运行

需要 Node.js 20 或更新版本。安装依赖后即可在无 Laya/Jev 配置的机器上运行 `doctor`、简单任务示例和测试：

```sh
npm ci
npm test
node bin/model-router-engine.mjs doctor
node bin/model-router-engine.mjs recommend < examples/recommend.json
```

也可用 `npm pack` 生成可移植 npm 包，或 `npm install -g .` 安装 `model-router-engine` 命令。这个包不含模型权重、API Key、候选模型的调用凭据或私人路径。

仓库和 npm 包均附带 [本地 Codex Skill](skills/model-router-engine/SKILL.md)。从仓库目录安装到 Codex：

```sh
mkdir -p "$HOME/.codex/skills"
ln -s "$PWD/skills/model-router-engine" "$HOME/.codex/skills/model-router-engine"
```

Skill 的包装命令会定位同一仓库中的引擎，也可以通过 `MODEL_ROUTER_ENGINE_HOME` 指向另一个检出目录。安装后让智能体按 Skill 的输入契约给出建议；它不会替智能体执行模型切换。

复杂任务需要至少一个已配置决策后端。无配置时返回 `status: "profile_unavailable"`，`selected: null`，不猜测模型。简单任务的规则路径在无配置时仍可运行。

## 配置真实决策后端

本地 Laya Typed-Decisions 使用单次 Python/Core ML 调用。先自行安装兼容的 `laya_coreml` Python 环境和 Typed-Decisions Core ML 权重，然后设置：

```sh
export LAYA_PYTHON=/path/to/python
export LAYA_MODEL_PATH=/path/to/typed-decisions-coreml
```

Jev 使用 `@typesafe-ai/sdk`。设置 `TYPESAFE_API_KEY`，或在 macOS 钥匙串中使用当前账号、服务名 `typesafe.ai.jev` 的密码项。命令不会输出密钥。可选 `ROUTER_TIMEOUT_MS`（默认 20000）和 `LAYA_CONFIDENCE_THRESHOLD`（默认 0.5）。`doctor` 只检查配置和路径，不发起付费模型请求。

```sh
node bin/model-router-engine.mjs doctor
```

复杂任务的完整示例请查看 `examples/compare.json` 中的 `cases[0]`，取其 `profile` 和 `candidates` 作为 `recommend` 请求。`compare` 可以直接读取完整文件：

```sh
npm run compare
```

`compare` 会在同一任务上分别执行 Laya-only、Jev-only、Laya→Jev，记录 `status`、`source`、`provenance`、所选候选 ID 和耗时。配置 Jev 后它会实际调用 Jev，可能产生用量；结果不是准确率统计。

## 输入输出契约

`recommend` 从标准输入读取一个 JSON 对象，写一个 JSON 对象到标准输出：

```json
{
  "profile": {
    "taskType": "coding",
    "difficulty": "hard",
    "requiredCapabilities": ["coding"],
    "modalities": ["text"],
    "languages": ["zh"],
    "contextRequirement": 32000,
    "outputRequirement": 1000,
    "privacy": "normal"
  },
  "candidates": [{
    "id": "route-id",
    "modelId": "actual-model-id",
    "provider": "provider-id",
    "capabilities": ["coding"],
    "modalities": ["text"],
    "languages": ["zh"],
    "contextWindow": 64000,
    "maxOutput": 8000,
    "costTier": 2,
    "latencyTier": 2,
    "privacy": "remote",
    "status": "qualified",
    "credentialStatus": "active"
  }]
}
```

`id` 是调用方路由 ID；可选的 `modelId` 是真实执行模型 ID，不传则等于 `id`。候选的能力、状态、隐私、上下文和凭据状态必须由调用方根据自身验证结果显式给出。这个引擎不从模型名字推断能力，也不接受任务原文、prompt、API Key、token 或候选调用凭据。任务类型和能力值使用由调用方自定的稳定标识；候选与任务必须使用同一组标识。

输出的顶层 `mode` 固定为 `advisory`；`status` 可为 `resolved`、`fallback`、`no_match` 或 `profile_unavailable`。成功时 `selected.id` 是输入候选的路由 ID、`selected.modelId` 是实际模型 ID；无匹配时 `selected` 为 `null`。`source`、`provenance.primary`、`selectedBy`、`fallbackReason` 和调用次数表示规则、Laya 或 Jev 哪条路参与了决定。`roles` 可包含多角色建议，调用方仍需按自身执行与验证流程处理。

命令正常返回 JSON 时退出码为 0，包括业务层的无匹配或后端未配置；输入验证错误退出 2；运行时启动失败退出 3。输入上限为 1 MiB、候选上限为 100 个。程序化接入可导入 `model-router-engine` 的 `recommend`、`compare` 和 `createClients`。

## 验证边界

仓库包含固定测试和 Linux/macOS/Windows Node CI。它们验证契约、超时、回退和建议结果；真实 Laya 权重与 Jev Key 不在 CI 中。已有的独立冻结基准（216 个样本）曾测得 Laya Typed-Decisions 40.74%、Jev 97.22%，且 Laya 置信度均低于 0.5；这是先前样本的结果，并非本仓库 CI 重跑。当前阈值会使低置信度 Laya 走 Jev 回退，因此建议保持人工复核，不应把建议直接用作自动模型切换。
