import { useEffect, useState } from 'react'

type HelloResponse = { message: string }

function App() {
  const [message, setMessage] = useState<string>('Loading...')

  useEffect(() => {
    // "/api" is proxied to the Express server by Vite (see vite.config.ts)
    fetch('/api/hello')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HelloResponse>
      })
      .then((data) => setMessage(data.message))
      .catch((err: Error) => setMessage(`Server unavailable: ${err.message}`))
  }, [])

  return (
    <main>
      <h1>Interview Prep</h1>
      <p>Message from server: {message}</p>
    </main>
  )
}

export default App
