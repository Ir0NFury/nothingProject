import express from 'express'

// The app is created separately from index.ts (which starts listening),
// so tests can import it later without opening a real port.
export const app = express()

app.use(express.json())

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello world from Express!' })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})
