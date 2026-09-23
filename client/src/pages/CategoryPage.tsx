import { Link, useParams } from 'react-router'

// Placeholder until the questions step fetches the category by slug.
export function CategoryPage() {
  const { slug } = useParams()

  return (
    <section className="grid gap-4">
      <h1>{slug}</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Questions coming soon</p>
      <p>
        <Link to="/" className="underline underline-offset-2">Back to categories</Link>
      </p>
    </section>
  )
}
