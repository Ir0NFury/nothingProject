import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward /api requests to the Express server during development,
    // so the browser sees one origin and we avoid CORS setup.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    // Node by default; component tests opt into jsdom with a file comment.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
