import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['src/renderer/tests/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
})
