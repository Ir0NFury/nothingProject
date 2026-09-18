import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="grid gap-4">
      <h1>Page not found</h1>
      <p>
        <Link to="/" className="underline underline-offset-2">Go home</Link>
      </p>
    </section>
  )
}
