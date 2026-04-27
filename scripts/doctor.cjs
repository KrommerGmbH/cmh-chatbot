#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function ok(label, detail) {
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
  console.warn(`⚠️ ${label}${detail ? ` — ${detail}` : ''}`);
}

let hasFail = false;

const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (major >= 20) ok('Node.js version', process.version);
else {
  hasFail = true;
  fail('Node.js version', `${process.version} (>=20 required)`);
}

const envPorts = {
  CMH_LLM_PORT: process.env.CMH_LLM_PORT || '(default)',
  CMH_ENGINE_PORT: process.env.CMH_ENGINE_PORT || '(default)',
  CMH_UI_PORT: process.env.CMH_UI_PORT || '(default)',
};
ok('Port env', `${envPorts.CMH_LLM_PORT} / ${envPorts.CMH_ENGINE_PORT} / ${envPorts.CMH_UI_PORT}`);

const runtimeCheck = spawnSync('node', ['scripts/ensure-llama-runtime.cjs', '--check', '--print-path'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if ((runtimeCheck.status ?? 1) === 0) {
  ok('llama-server runtime', runtimeCheck.stdout.trim());
} else {
  hasFail = true;
  fail('llama-server runtime', (runtimeCheck.stderr || runtimeCheck.stdout || '').trim());
}

const modelsDir = path.resolve(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
  hasFail = true;
  fail('models directory', 'missing ./models');
} else {
  const files = fs.readdirSync(modelsDir);
  const ggufCount = files.filter((f) => /\.gguf$/i.test(f)).length;
  if (ggufCount > 0) {
    ok('models', `${ggufCount} GGUF file(s)`);
  } else {
    warn('models', 'no *.gguf found (local model chat may fail)');
  }
}

if (hasFail) {
  process.exit(1);
}

ok('doctor', 'all required checks passed');
