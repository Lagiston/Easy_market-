import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Default 5000ms is tight enough that otherwise-passing tests
    // intermittently time out only when the full suite runs in parallel
    // across many worker processes (seen live: different files fail each
    // run — UsersPage, ContactPage, ProductsPage — never the same one twice,
    // and every one passes reliably alone or in small groups). Raising this
    // gives real CPU contention enough headroom without masking an actual
    // bug, which would still fail regardless of how long it's given.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
