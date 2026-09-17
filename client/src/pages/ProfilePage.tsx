import { useCallback, useEffect, useState } from 'react'
import { getMe } from '../api/auth'
import type { User } from '../api/types'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: User }

export function ProfilePage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getMe(controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <section>
      <h1>Profile</h1>
      {state.status === 'loading' && <p role="status">Loading…</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>Could not load your profile: {state.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {state.status === 'ready' && (
        <dl>
          <dt>Email</dt>
          <dd>{state.data.email}</dd>
          <dt>Role</dt>
          <dd>{state.data.role}</dd>
          <dt>Member since</dt>
          <dd>{new Date(state.data.createdAt).toLocaleDateString()}</dd>
        </dl>
      )}
    </section>
  )
}
