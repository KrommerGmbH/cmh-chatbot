#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { getDevPorts } = require('./dev-ports.cjs');

const { llmPort, enginePort, uiPort } = getDevPorts();

console.log(`[dev:renderer] starting vite on 127.0.0.1:${uiPort} (engine: ${enginePort}, llm: ${llmPort})`);

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
