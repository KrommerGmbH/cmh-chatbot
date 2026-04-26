#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const { getDevPorts } = require('./dev-ports.cjs');

const { llmPort, enginePort } = getDevPorts();

console.log('[dev:engine] building before start');
const build = spawnSync('pnpm', ['build'], {
  stdio: 'inherit',
  shell: true,
});

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

console.log(`[dev:engine] starting engine on 127.0.0.1:${enginePort} (llm: ${llmPort})`);

const child = spawn('node', [
  './dist/cli.js',
  'start',
  '--server-url',
  `http://127.0.0.1:${llmPort}`,
  '--port',
  String(enginePort),
  '--host',
  '127.0.0.1',
  '--no-mdns',
], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
