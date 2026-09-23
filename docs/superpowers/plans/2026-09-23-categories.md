# Categories on the Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load the project skills `express-api` (server tasks) and `react-feature` (client tasks). They pin down file locations and conventions this plan follows.

**Goal:** Store interview categories in Postgres, serve them from a public `GET /api/categories`, and render them as linked tiles on the home page.

**Architecture:** A new `categories` table (Drizzle schema + generated migration) is filled by an insert-if-missing seed script. A `server/src/categories/` feature folder (service + router) serves the public list ordered by `position, name`. On the client, `api/categories.ts` unwraps the `{ categories }` envelope, `HomePage` swaps its hello-world fetch for the category tiles, and a placeholder `CategoryPage` answers `/categories/:slug`.

**Tech Stack:** Express 5, Zod 4, drizzle-orm 0.45 + drizzle-kit 0.31 + pg, Vitest 5 + Supertest; React 19, react-router 8, Testing Library + user-event, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-23-categories-design.md` (read it alongside this plan).

## Global Constraints

- TypeScript `strict`. Server relative imports end in `.js`; client relative imports have no extension.
- Response shape: `{ "categories": [{ id, slug, name, description }] }`. `position` and `created_at` never leave the server.
- Order: `position` ascending, then `name` ascending. `position` is **not** unique and has **no** index.
- Seed is **insert-if-missing, never update**: `.onConflictDoNothing({ target: categories.slug })`.
- `GET /api/categories` is public: no `requireAuth`.
- No new dependencies. No React Query/SWR, no `jest-dom`, no `CategoryCard` component yet.
- **Claude must never read or write `server/.env`.** Commands that need the dev DB may pass `DATABASE_URL=postgres://app:app@localhost:5433/interview_prep` inline (the non-secret local compose credential).
- Postgres must be running (`npm run db:up`) for migrations, the seed and server tests.
- Commit after each task: imperative subject, ending with the session's `Co-Authored-By` trailer.

## Deliberate interpretations of the spec

1. **`/api/hello` is deleted in the client task (Task 4), not as its own step.** Deleting the endpoint before `HomePage` stops calling it would leave a commit where the dev app shows an error.
2. **The `CLAUDE.md` update ships with the seed script (Task 2)**, since it documents that script's command.
3. **`CategoryPage` heading** shows the raw slug. The page has no category data until the questions step fetches it by slug.
4. **Error copy** on the home page changes from "Server unavailable: …" to "Couldn't load categories: …". The markup (`role="alert"` + Retry) is unchanged.

## File map

```
server/src/db/schema.ts                    modify  add `categories` table + CategoryRow type
server/drizzle/0001_<generated>.sql         create  generated migration (+ meta/ snapshot, journal)
server/src/db/seed-categories.ts            create  insert-if-missing seed for the 5 starter rows
server/package.json                         modify  add db:seed-categories script
CLAUDE.md                                   modify  document the seed command; add categories to structure
server/test/categories.routes.test.ts       create  route tests
server/src/categories/categories.service.ts create  listCategories()
server/src/categories/categories.routes.ts  create  categoriesRouter
server/src/app.ts                           modify  mount router; delete /api/hello
client/src/api/types.ts                     modify  add Category
client/src/api/categories.ts                create  getCategories()
client/src/api/hello.ts                     delete
client/src/pages/HomePage.test.tsx          create  tiles / error+retry / empty
client/src/pages/HomePage.tsx               modify  tiles instead of hello message
client/src/pages/CategoryPage.tsx           create  placeholder
client/src/App.tsx                          modify  route categories/:slug
```

---

### Task 1: `categories` table and migration

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/drizzle/0001_<generated-name>.sql`, plus changes under `server/drizzle/meta/`

**Interfaces:**
- Produces: `categories` table export and `CategoryRow` type from `server/src/db/schema.ts`. Drizzle property names: `id`, `slug`, `name`, `description`, `position`, `createdAt`.

- [ ] **Step 1: Add the table to the schema**

In `server/src/db/schema.ts`, add `integer` to the import:

```ts
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
```

Add the table after `refreshTokens`:

```ts
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  // URL key (/categories/react-theory) and the seed's conflict target.
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  // Sort order. Deliberately not unique: swapping two positions would violate
  // a unique constraint halfway through. Ties are broken by name.
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Add the row type next to the others:

```ts
export type CategoryRow = typeof categories.$inferSelect
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate -w @app/server`
Expected: a new `server/drizzle/0001_<random_name>.sql` and updated `meta/_journal.json` + new `meta/0001_snapshot.json`.

- [ ] **Step 3: Read the generated SQL**

Run: `cat server/drizzle/0001_*.sql`
Expected (column order may differ):

```sql
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
```

It must contain no `DROP`, no change to `users` / `refresh_tokens`, and no index on `position`.

- [ ] **Step 4: Apply to the dev DB**

Run: `npm run db:up && npm run db:migrate -w @app/server`
Expected: drizzle-kit reports migrations applied, no errors. (The test DB migrates automatically in the test global setup.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/schema.ts server/drizzle
git commit -m "Add categories table"
```

---

### Task 2: Seed script for the starter categories

**Files:**
- Create: `server/src/db/seed-categories.ts`
- Modify: `server/package.json` (scripts)
- Modify: `CLAUDE.md` (commands, first-time setup, structure)

**Interfaces:**
- Consumes: `categories` from `server/src/db/schema.ts`; `db`, `pool` from `server/src/db/client.ts`.
- Produces: npm script `db:seed-categories` in `@app/server`.

- [ ] **Step 1: Write the seed script**

Create `server/src/db/seed-categories.ts`:

```ts
import { db, pool } from './client.js'
import { categories } from './schema.js'

type NewCategory = typeof categories.$inferInsert

const starterCategories: NewCategory[] = [
  { position: 1, slug: 'react-theory', name: 'React theory', description: 'Hooks, rendering, reconciliation, state and effects' },
  { position: 2, slug: 'js-theory', name: 'JavaScript theory', description: 'Closures, the event loop, prototypes, `this`, async' },
  { position: 3, slug: 'react-coding', name: 'React coding', description: 'Build components and hooks, fix bugs in live code' },
  { position: 4, slug: 'js-coding', name: 'JavaScript coding', description: 'Algorithms and utility functions in plain JS' },
  { position: 5, slug: 'general', name: 'General questions', description: 'Experience, architecture, behavioral questions' },
]

// Inserts the starter categories that don't exist yet.
// Never updates: once the admin panel exists these rows are admin-owned,
// and an upsert would revert the admin's edits on every run.
async function main() {
  // ON CONFLICT DO NOTHING + RETURNING gives back only the rows actually inserted.
  const inserted = await db
    .insert(categories)
    .values(starterCategories)
    .onConflictDoNothing({ target: categories.slug })
    .returning({ slug: categories.slug })

  const insertedSlugs = new Set(inserted.map((row) => row.slug))
  for (const { slug } of starterCategories) {
    console.log(insertedSlugs.has(slug) ? `Created ${slug}` : `Skipped ${slug} (already exists)`)
  }
}

try {
  await main()
} finally {
  await pool.end()
}
```

- [ ] **Step 2: Add the npm script**

In `server/package.json`, after `db:seed-admin`:

```json
    "db:seed-admin": "tsx --env-file-if-exists=.env src/db/seed-admin.ts",
    "db:seed-categories": "tsx --env-file-if-exists=.env src/db/seed-categories.ts"
```

- [ ] **Step 3: Run it twice**

Run: `npm run db:seed-categories -w @app/server`
Expected: five `Created …` lines.

Run it again.
Expected: five `Skipped … (already exists)` lines.

- [ ] **Step 4: Update CLAUDE.md**

In `## Commands`, after the `db:seed-admin` line:

```markdown
- `npm run db:seed-categories -w @app/server`: insert the starter categories that are missing (never overwrites existing rows)
```

In `## First-time setup`, after `npm run db:seed-admin -w @app/server`:

```bash
npm run db:seed-categories -w @app/server
```

In `## Structure`, change the server line to:

```
server/              Express API (src/auth, src/admin, src/categories, src/db, src/lib, src/middleware)
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add server/src/db/seed-categories.ts server/package.json CLAUDE.md
git commit -m "Add seed script for the starter categories"
```

---

### Task 3: `GET /api/categories`

**Files:**
- Test: `server/test/categories.routes.test.ts`
- Create: `server/src/categories/categories.service.ts`
- Create: `server/src/categories/categories.routes.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `categories` from `server/src/db/schema.ts`, `db` from `server/src/db/client.ts`.
- Produces: `listCategories(): Promise<{ id: string; slug: string; name: string; description: string }[]>`; `categoriesRouter` (named export); HTTP `GET /api/categories` → `200 { categories: [...] }`.

- [ ] **Step 1: Write the failing tests**

Create `server/test/categories.routes.test.ts`:

```ts
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { db } from '../src/db/client.js'
import { categories } from '../src/db/schema.js'

function category(position: number, slug: string, name = slug) {
  return { position, slug, name, description: `About ${name}` }
}

describe('GET /api/categories', () => {
  it('returns an empty list when there are no categories', async () => {
    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ categories: [] })
  })

  it('orders categories by position', async () => {
    await db.insert(categories).values([category(3, 'c'), category(1, 'a'), category(2, 'b')])

    const res = await request(app).get('/api/categories')

    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['a', 'b', 'c'])
  })

  it('breaks position ties by name', async () => {
    await db.insert(categories).values([category(1, 'second', 'Beta'), category(1, 'first', 'Alpha')])

    const res = await request(app).get('/api/categories')

    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['first', 'second'])
  })

  it('returns only the public fields', async () => {
    await db.insert(categories).values(category(1, 'react-theory', 'React theory'))

    const res = await request(app).get('/api/categories')

    expect(res.body.categories).toEqual([
      { id: expect.any(String), slug: 'react-theory', name: 'React theory', description: 'About React theory' },
    ])
  })

  it('does not require an Authorization header', async () => {
    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w @app/server -- categories.routes`
Expected: FAIL. Every test gets `404` (the `/api` catch-all), so the status and body assertions fail.

- [ ] **Step 3: Write the service**

Create `server/src/categories/categories.service.ts`:

```ts
import { asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { categories } from '../db/schema.js'

// Public list for the home page. Selects only the columns clients may see:
// position and createdAt are for sorting and auditing, not display.
export function listCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name))
}
```

- [ ] **Step 4: Write the router**

Create `server/src/categories/categories.routes.ts`:

```ts
import { Router } from 'express'
import * as categoriesService from './categories.service.js'

export const categoriesRouter = Router()

// Public: the category list is shown to guests too.
categoriesRouter.get('/', async (_req, res) => {
  const categories = await categoriesService.listCategories()
  res.json({ categories })
})
```

- [ ] **Step 5: Mount the router**

In `server/src/app.ts`, add the import:

```ts
import { categoriesRouter } from './categories/categories.routes.js'
```

Add the mount after the admin router:

```ts
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/categories', categoriesRouter)
```

Leave `/api/hello` in place: the client still calls it until Task 4.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -w @app/server`
Expected: all server tests PASS, including the 5 new ones.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add server/src/categories server/src/app.ts server/test/categories.routes.test.ts
git commit -m "Add public GET /api/categories endpoint"
```

---

### Task 4: Category tiles on the home page

**Files:**
- Modify: `client/src/api/types.ts`
- Create: `client/src/api/categories.ts`
- Delete: `client/src/api/hello.ts`
- Modify: `server/src/app.ts` (remove `/api/hello`)
- Test: `client/src/pages/HomePage.test.tsx`
- Modify: `client/src/pages/HomePage.tsx`
- Create: `client/src/pages/CategoryPage.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/categories` → `{ categories: Category[] }` (Task 3); `apiFetch<T>(path, init)` from `client/src/api/client.ts`.
- Produces: `type Category = { id: string; slug: string; name: string; description: string }`; `getCategories(signal?: AbortSignal): Promise<Category[]>`; `CategoryPage` (named export); route `/categories/:slug`.

- [ ] **Step 1: Add the type and API function**

Append to `client/src/api/types.ts`:

```ts
export type Category = {
  id: string
  slug: string
  name: string
  description: string
}
```

Create `client/src/api/categories.ts`:

```ts
import { apiFetch } from './client'
import type { Category } from './types'

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const { categories } = await apiFetch<{ categories: Category[] }>('/api/categories', { signal })
  return categories
}
```

- [ ] **Step 2: Write the failing page tests**

Create `client/src/pages/HomePage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

const categories = [
  { id: '1', slug: 'react-theory', name: 'React theory', description: 'Hooks and rendering' },
  { id: '2', slug: 'js-theory', name: 'JavaScript theory', description: 'Closures and the event loop' },
]

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderPage() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('renders a linked tile for each category', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { categories }))
    renderPage()

    expect(screen.getByRole('status')).toBeTruthy()
    const react = await screen.findByRole('link', { name: /React theory/ })
    expect(react.getAttribute('href')).toBe('/categories/react-theory')
    expect(react.textContent).toContain('Hooks and rendering')
    const js = screen.getByRole('link', { name: /JavaScript theory/ })
    expect(js.getAttribute('href')).toBe('/categories/js-theory')
    expect(js.textContent).toContain('Closures and the event loop')
  })

  it('shows an error with Retry, and Retry refetches', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }))
      .mockResolvedValueOnce(json(200, { categories }))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Something went wrong')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: /React theory/ })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state when there are no categories', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { categories: [] }))
    renderPage()

    expect(await screen.findByText('No categories yet')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test -w @app/client -- HomePage`
Expected: FAIL. The page still calls `getHello` and renders "Message from server: …", so no category links or empty state appear.

- [ ] **Step 4: Rewrite HomePage**

Replace `client/src/pages/HomePage.tsx`:

```tsx
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
```

- [ ] **Step 5: Delete the hello scaffolding**

Run: `git rm client/src/api/hello.ts`

In `server/src/app.ts`, delete the whole `app.get('/api/hello', …)` block and the blank line after it. Keep `/api/health`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -w @app/client`
Expected: all client tests PASS, including the 3 new ones.

- [ ] **Step 7: Add the placeholder page and route**

Create `client/src/pages/CategoryPage.tsx`:

```tsx
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
```

In `client/src/App.tsx`, add the import (alphabetical, after `Layout`'s line group):

```tsx
import { CategoryPage } from './pages/CategoryPage'
```

and the route right after the index route:

```tsx
        <Route index element={<HomePage />} />
        <Route path="categories/:slug" element={<CategoryPage />} />
```

- [ ] **Step 8: Full verification**

Run: `npm run typecheck && npm run lint -w @app/client && npm run test && npm run build`
Expected: all pass, no lint warnings in the touched files.

Manual check (`npm run dev`, open http://localhost:5173): five tiles in seed order; clicking "React theory" shows the placeholder at `/categories/react-theory`; "Back to categories" returns home; `curl -s localhost:4000/api/hello` returns the `NOT_FOUND` error body.

- [ ] **Step 9: Commit**

```bash
git add client/src server/src/app.ts
git commit -m "Show category tiles on the home page"
```
