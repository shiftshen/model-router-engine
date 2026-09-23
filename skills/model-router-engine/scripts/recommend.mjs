#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bundledRoot = resolve(skillDir, '../..');
const linkedRoot = resolve(skillDir, 'engine');
const configuredRoot = process.env.MODEL_ROUTER_ENGINE_HOME;
const engineRoot = resolve(configuredRoot || (existsSync(resolve(linkedRoot, 'bin/model-router-engine.mjs')) ? linkedRoot : bundledRoot));
const engineCli = resolve(engineRoot, 'bin/model-router-engine.mjs');

if (!existsSync(engineCli)) {
  process.stderr.write(
    'Model Router Engine CLI not found. Set MODEL_ROUTER_ENGINE_HOME to the engine checkout.\n',
  );
  process.exit(2);
}

const result = spawnSync(process.execPath, [engineCli, 'recommend'], {
  cwd: engineRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(2);
}
process.exit(result.status ?? 2);
