# Categories on the home page: Design Spec

- **Date:** 2026-09-23
- **Status:** Implemented
- **Scope:** the `categories` table, a public read API, and category tiles on the home page

## 1. Goals

- The home page shows one tile per category, fetched from the API instead of hard-coded in the client.
- The first five categories live in the database, put there by a seed script.
- A tile links to `/categories/:slug`, which renders a placeholder until the questions step.
- The data model is shaped so the admin panel can own these rows later without a rewrite.

### Non-goals (for now)

Questions and answers, Markdown rendering, admin create/edit/delete, per-category question counts, pagination, search, and caching headers. Each arrives in its own step.

## 2. Data model (Drizzle, `server/src/db/schema.ts`)

### `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `defaultRandom()`, like `users` |
| `slug` | text, unique, not null | URL key (`/categories/react-theory`) and the seed's conflict target |
| `name` | text, not null | shown as the tile heading |
| `description` | text, not null | one short line under the heading |
| `position` | integer, not null | sort order, **not** unique |
| `created_at` | timestamptz | default `now()` |

Decisions:

- **`position` is not unique.** A unique constraint would make reordering fail halfway through a swap, and fixing that needs deferrable constraints. Duplicate positions are broken by `name`.
- **No index on `position`.** With a handful of rows, a sequential scan beats an index lookup. Add one if the table ever grows large.
- **No `updated_at` yet.** Adding a nullable timestamp column is a cheap migration when admin editing arrives.
- The migration is generated with `drizzle-kit generate`, committed under `server/drizzle/`, and applied with `drizzle-kit migrate`, as the existing tables are.

## 3. Seed data

`server/src/db/seed-categories.ts`, run with `npm run db:seed-categories -w @app/server`, follows the `seed-admin.ts` pattern.

- Inserts the five rows below with `ON CONFLICT (slug) DO NOTHING` (Drizzle: `.onConflictDoNothing({ target: categories.slug })`).
- **Insert-if-missing, never update.** Once the admin panel exists, these rows are admin-owned content. An upsert would silently revert the admin's edits on every run.
- Idempotent: running it twice changes nothing and reports what it skipped.

| position | slug | name | description |
|---|---|---|---|
| 1 | `react-theory` | React theory | Hooks, rendering, reconciliation, state and effects |
| 2 | `js-theory` | JavaScript theory | Closures, the event loop, prototypes, this, async |
| 3 | `react-coding` | React coding | Build components and hooks, fix bugs in live code |
| 4 | `js-coding` | JavaScript coding | Algorithms and utility functions in plain JS |
| 5 | `general` | General questions | Experience, architecture, behavioral questions |

The alternative — a custom data migration (`drizzle-kit generate --custom`) that runs automatically everywhere — was rejected: it mixes editable content into schema history, and changing the starter set would mean writing another migration.

## 4. API

New folder `server/src/categories/`, mirroring `auth/`:

- `categories.service.ts` — `listCategories()` returns the public columns ordered by `position, name`.
- `categories.routes.ts` — the router, mounted in `app.ts` as `app.use('/api/categories', categoriesRouter)`.

### `GET /api/categories`

- **Public.** No `requireAuth`: the MVP calls these public pages.
- **200** `{ "categories": [{ "id": "...", "slug": "react-theory", "name": "React theory", "description": "..." }] }`
- Ordered by `position`, then `name`.
- `position` and `created_at` stay out of the response. The client sorts nothing and displays neither; the future admin endpoint can return them.
- The list is wrapped in an object, like the existing `{ user }` responses, so fields such as pagination can be added later without breaking clients.
- An empty table returns `{ "categories": [] }`, not a 404.

### Cleanup

`GET /api/hello` and `client/src/api/hello.ts` are deleted. The endpoint was scaffolding that proved the client-server wiring, and `HomePage` was its only consumer. `GET /api/health` stays: that one is for deploys.

## 5. Client

- **`api/types.ts`** — add `Category = { id, slug, name, description }`, hand-written to match the server response, as `User` is. A `shared/` workspace can wait for something that justifies it.
- **`api/categories.ts`** — `getCategories(signal?: AbortSignal)` calls `apiFetch<{ categories: Category[] }>('/api/categories', { signal })` and returns `.categories`, so components never see the envelope. No special casing for the public route: `apiFetch` attaches a bearer token when one is in memory, which the server ignores, and its refresh-and-retry path only triggers on a 401, which this route never returns.
- **`pages/HomePage.tsx`** — keeps the `loading | error | ready` state machine it uses today, with `getHello` replaced by `getCategories`, the existing `role="status"` / `role="alert"` + Retry treatment, and a new empty state ("No categories yet") when the list is empty.
- **Tiles** — a `<ul>` with `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Each item holds a single `Link` to `/categories/<slug>` wrapping the name and description, styled like the existing bordered, hover-filled controls. One link per card keeps it to one tab stop and one focus ring. A `CategoryCard` component is extracted only when the admin panel reuses it.
- **`pages/CategoryPage.tsx`** — a placeholder: a heading, "Questions coming soon", and a link home. Registered in `App.tsx` at `categories/:slug`, inside the existing `Layout` route. The questions step replaces it with a real fetch by slug.

## 6. Testing

Tests are written before the implementation, as in the auth work.

**Server — `server/test/categories.routes.test.ts`** (Supertest, real test DB, truncated before each test by `server/test/setup.ts`):

- empty table → `200 { categories: [] }`
- rows inserted out of order come back ordered by `position`
- the response objects carry `id`, `slug`, `name`, `description` and nothing else
- the request succeeds with no `Authorization` header

**Client — `client/src/pages/HomePage.test.tsx`** (Vitest + Testing Library, `fetch` mocked, rendered in a `MemoryRouter`):

- tiles render each name and description, with `href="/categories/<slug>"`
- the error state shows Retry, and clicking it refetches
- an empty list renders the empty state

**Seed script:** untested, like `seed-admin.ts`. Verified by running it twice and checking the second run inserts nothing.

## 7. Documentation

- `CLAUDE.md`: add `npm run db:seed-categories -w @app/server` to the commands list and to the first-time setup block.

## 8. Order of work

1. Schema + generated migration, applied to the dev DB.
2. Seed script and its npm script.
3. Server: failing route tests, then service and router, then mount in `app.ts`.
4. Client: failing `HomePage` tests, then `api/categories.ts`, tiles, and the placeholder page.
5. Delete `/api/hello` and `api/hello.ts`.
6. Update `CLAUDE.md`.
