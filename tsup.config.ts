import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry — full library
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    splitting: false,
    external: ['node-llama-cpp'],
  },
  // Client entry — lightweight SDK for Edge/Shopware Admin
  {
    entry: { client: 'src/client.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    splitting: false,
    external: [],
  },
  // Server entry — Hono routes + factory
  {
    entry: { server: 'src/server.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    splitting: false,
    external: ['node-llama-cpp'],
  },
  // CLI entry — no bundling of node_modules (native binaries cannot be bundled)
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    sourcemap: true,
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    splitting: false,
    external: ['node-llama-cpp'],
  },
]);
