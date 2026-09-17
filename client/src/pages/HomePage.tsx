import { useEffect, useState } from 'react'
import { getHello } from '../api/hello'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: string }

export function HomePage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    getHello(controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <section>
      <h1>Interview Prep</h1>
      {state.status === 'loading' && <p role="status">Loading…</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>Server unavailable: {state.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {state.status === 'ready' && <p>Message from server: {state.data}</p>}
    </section>
  )
}
