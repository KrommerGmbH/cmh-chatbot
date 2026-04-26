#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { getDevPorts } = require('./dev-ports.cjs');

const { llmPort } = getDevPorts();

console.log(`[dev:llm] starting llama-server on 127.0.0.1:${llmPort}`);

const child = spawn('.\\bin\\llama-b8712\\llama-server.exe', [
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
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
