import { useEffect, useState } from 'react'
import { pingAdmin } from '../../api/admin'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: boolean }

export function AdminPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    pingAdmin(controller.signal)
      .then(({ ok }) => setState({ status: 'ready', data: ok }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <section className="grid gap-4">
      <h1>Admin</h1>
      {state.status === 'loading' && <p role="status" className="text-neutral-500 dark:text-neutral-400">Checking admin access…</p>}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-2 text-red-700 dark:text-red-400">
          <p>Admin check failed: {state.message}</p>
          <button type="button" onClick={retry} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">Retry</button>
        </div>
      )}
      {state.status === 'ready' && <p>Server says admin access is {state.data ? 'OK' : 'not OK'}.</p>}
    </section>
  )
}
