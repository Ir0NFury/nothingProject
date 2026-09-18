---
name: react-feature
description: Use when adding or changing pages, forms, API calls, routes or client tests in this repo's React client (client/).
---

# React feature conventions (client/)

## Overview
Components never call `fetch` directly. They call typed functions in `api/<feature>.ts`, which go through `apiFetch`. Auth state comes from `useAuth()`, and route protection from `<RequireAuth>`. Client auth is specified in `docs/superpowers/specs/2026-09-17-auth-design.md` §7.

## Where things live
| Thing | Path |
|---|---|
| HTTP + token handling | `client/src/api/client.ts`: `apiFetch<T>(path: string, init?: RequestInit): Promise<T>`. The caller passes `body: JSON.stringify(...)`; the function returns the parsed JSON. Also exports `ApiError extends Error { status, code, details? }` |
| Feature API calls and types | `client/src/api/<feature>.ts`. Functions unwrap the response envelope: `{ categories }` becomes `Category[]` |
| Field-error helper | `client/src/api/fieldErrors.ts`: `getFieldErrors<F extends string>(err: unknown): Partial<Record<F, string>>`, which returns the first message for each field and `{}` if the error isn't a `VALIDATION_ERROR` |
| Auth | `auth/useAuth.ts` → `useAuth(): { user, status, login, register, logout }`; `auth/RequireAuth.tsx` → `RequireAuth`; `components/Layout.tsx` → `Layout` (all named exports). `main.tsx` wraps `App` in `BrowserRouter` and `AuthProvider` |
| Pages | `client/src/pages/<Name>Page.tsx`; admin pages in `pages/admin/` |
| Shared components | `client/src/components/` |
| Routes | `client/src/App.tsx`, nested inside `<Route element={<Layout />}>` |
| Tests | next to the file: `<Name>.test.tsx` |

## Rules
- **Exports:** named exports for pages and components. The only default export is `App`.
- **Imports:** relative imports have no file extension (`./api/client`). The one exception is the existing `./App.tsx` in `main.tsx`.
- **Page names:** `<Name>Page`, e.g. `HomePage`, `LoginPage`, `NotFoundPage`, `admin/AdminPage`.
- **Data loading:**
  - Use `useEffect` with an `AbortController`. Pass `signal` to the API function and abort in the cleanup.
  - Model the state as one union: `{ status: 'loading' } | { status: 'error'; message } | { status: 'ready'; data }`.
  - Always render the loading, error (with a retry button) and empty states.
  - Don't add React Query or SWR without asking. That decision is deliberately postponed.
- **Auth:**
  - Wrap protected routes in `<RequireAuth>`, adding `roles={['admin']}` for admin pages.
  - Use `useAuth()` only to show or hide UI. The server is the real security boundary.
  - Never touch tokens in components.
  - Don't handle 401s in pages: `apiFetch` already refreshes the token, and `AuthProvider` handles the "auth lost" event.
- **Forms:**
  - Use plain controlled inputs; no form library.
  - Leave validation to the server. Don't repeat its rules on the client.
  - Disable the submit button while the request is running.
  - Map server errors:
    - `VALIDATION_ERROR` → `getFieldErrors` → an error under each field
    - a known conflict code (e.g. `SLUG_TAKEN`) → an error under that field
    - anything else → one error above the form
  - Clear a field's error when the user edits it.
  - Link each error to its input with `aria-invalid` and `aria-describedby`. Show form-level errors with `role="alert"`.
- **User content:** render it as text. Never use `dangerouslySetInnerHTML`.
- **Styling:** Tailwind v4 utility classes in the markup. No CSS modules, no styled-components, no `style` props.
  - `client/src/index.css` holds the `@import 'tailwindcss'`, the `body` colors and the base styles for plain semantic elements (`h1`, `h2`, `dt`, `dd`). Add to it only for elements pages use bare; everything else is utilities.
  - Every color needs its dark counterpart: `text-red-700 dark:text-red-400`, `border-neutral-300 dark:border-neutral-700`. Dark mode follows the OS setting.
  - Style state from the markup, not extra props: `aria-[current=page]:font-semibold` on `NavLink`, `aria-[invalid=true]:border-red-600` on inputs.
  - Page shells are `<section className="grid gap-4">`; forms are `grid gap-4` with `grid gap-1` fields.

## Tests (Vitest + React Testing Library + user-event)
- Components: start the file with `// @vitest-environment jsdom`. Pure modules like `api/client.ts` stay in the Node environment.
- Vitest runs with `globals: false`, so import `describe`, `it` and friends. `client/src/test/setup.ts` (a setup file) runs `cleanup()` and `vi.restoreAllMocks()` after each test. There's no `jest-dom`: use plain checks like `toBeTruthy()`, `getAttribute()` and `toHaveProperty('disabled', true)`.
- Mock global `fetch` (`vi.spyOn(globalThis, 'fetch')`) with real `Response` objects in the server's `{ error: { code, message, details } }` format. Don't mock `api/*` modules; that way the real `apiFetch` gets tested too.
- Mock `useAuth` only when a page reads it. Wrap renders in `MemoryRouter`.
- Query by role or label, not by class name or test id.
- Cover: loading → data, empty, error → retry, role-based UI, and every submit error path.

## Common mistakes
| Mistake | Fix |
|---|---|
| `fetch('/api/...')` in a component | Add a function to `api/<feature>.ts` |
| Storing the token in state or localStorage | `api/client.ts` owns it |
| Hiding an admin link and calling that "secure" | Also guard the route and rely on the server's `requireRole` |
| Separate `isLoading` / `error` flags | One status union |
