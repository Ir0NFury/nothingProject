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
    <section className="grid gap-4">
      <h1>Interview Prep</h1>
      {state.status === 'loading' && <p role="status" className="text-neutral-500 dark:text-neutral-400">Loading…</p>}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-2 text-red-700 dark:text-red-400">
          <p>Server unavailable: {state.message}</p>
          <button type="button" onClick={retry} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">Retry</button>
        </div>
      )}
      {state.status === 'ready' && <p>Message from server: {state.data}</p>}
    </section>
  )
}
