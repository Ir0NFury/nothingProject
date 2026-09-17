import { useCallback, useEffect, useState } from 'react'
import { pingAdmin } from '../../api/admin'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: boolean }

export function AdminPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    pingAdmin(controller.signal)
      .then(({ ok }) => setState({ status: 'ready', data: ok }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <section>
      <h1>Admin</h1>
      {state.status === 'loading' && <p role="status">Checking admin access…</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>Admin check failed: {state.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {state.status === 'ready' && <p>Server says admin access is {state.data ? 'OK' : 'not OK'}.</p>}
    </section>
  )
}
