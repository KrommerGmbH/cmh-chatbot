#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { spawnSync } = require('node:child_process');
const { getDevPorts } = require('./dev-ports.cjs');

const { llmPort } = getDevPorts();

console.log(`[dev:llm] starting llama-server on 127.0.0.1:${llmPort}`);

const runtime = spawnSync('node', ['scripts/ensure-llama-runtime.cjs', '--print-path'], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});

if ((runtime.status ?? 1) !== 0) {
  process.exit(runtime.status ?? 1);
}

const llamaServerCommand = runtime.stdout.trim();
if (!llamaServerCommand) {
  console.error('[dev:llm] failed to resolve llama-server command');
  process.exit(1);
}
console.log(`[dev:llm] command: ${llamaServerCommand}`);

const child = spawn(llamaServerCommand, [
  '--models-dir',
  'models',
  '--port',
  String(llmPort),
  '--host',
  '127.0.0.1',
  '-ngl',
  '0',
  '-c',
  '2048',
  '-np',
  '1',
  '--mmap',
  '--models-max',
  '1',
], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
