#!/usr/bin/env node

const { spawn } = require('node:child_process')

const host = process.env.CMH_HOST ?? '127.0.0.1'
const port = process.env.CMH_PORT ?? '4000'
const serverUrl = process.env.CMH_LLM_SERVER_URL
const logLevel = process.env.CMH_LOG_LEVEL ?? 'info'

if (!serverUrl) {
  console.error('[web:test:start] Missing CMH_LLM_SERVER_URL environment variable')
  process.exit(1)
}

const args = [
  './dist/cli.js',
  'start',
  '--host',
  host,
  '--port',
  String(port),
  '--server-url',
  serverUrl,
  '--log-level',
  logLevel,
  '--no-mdns',
]

console.log(`[web:test:start] starting engine on ${host}:${port}, llm=${serverUrl}`)

const child = spawn('node', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))
