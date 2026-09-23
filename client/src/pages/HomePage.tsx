import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getCategories } from '../api/categories'
import type { Category } from '../api/types'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Category[] }

export function HomePage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal)
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
          <p>Couldn't load categories: {state.message}</p>
          <button type="button" onClick={retry} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">Retry</button>
        </div>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="text-neutral-500 dark:text-neutral-400">No categories yet</p>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.map((category) => (
            <li key={category.id}>
              {/* One link per tile: one tab stop and one focus ring for the whole card. */}
              <Link
                to={`/categories/${category.slug}`}
                className="grid h-full gap-1 rounded-lg border border-neutral-300 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <h2 className="text-lg">{category.name}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{category.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
