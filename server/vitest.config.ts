import { defineConfig } from 'vitest/config'
import { testEnv } from './test/testEnv.js'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: testEnv,
    globalSetup: ['./test/globalSetup.ts'],
    setupFiles: ['./test/setup.ts'],
    // All files share one database, so run them one at a time.
    fileParallelism: false,
  },
})
