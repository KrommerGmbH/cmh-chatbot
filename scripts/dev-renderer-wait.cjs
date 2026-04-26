#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const { getDevPorts } = require('./dev-ports.cjs');

const { llmPort, enginePort, uiPort } = getDevPorts();
const healthUrl = `http-get://127.0.0.1:${enginePort}/api/health`;

console.log(`[dev:renderer:wait] waiting for ${healthUrl}`);
const wait = spawnSync('pnpm', ['exec', 'wait-on', healthUrl], {
  stdio: 'inherit',
  shell: true,
});

if ((wait.status ?? 1) !== 0) {
  process.exit(wait.status ?? 1);
}

console.log(`[dev:renderer:wait] starting vite on 127.0.0.1:${uiPort} (engine: ${enginePort}, llm: ${llmPort})`);

const child = spawn('pnpm', ['exec', 'vite', 'dev', '--host', '127.0.0.1', '--port', String(uiPort)], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    CMH_LLM_PORT: String(llmPort),
    CMH_ENGINE_PORT: String(enginePort),
    CMH_UI_PORT: String(uiPort),
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
