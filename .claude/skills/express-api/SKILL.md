---
name: express-api
description: Use when adding or changing server endpoints, database tables, services, middleware or server tests in this repo's Express + Drizzle backend (server/).
---

# Express API conventions (server/)

## Overview
Every endpoint follows the same flow: a Zod schema, then a thin route, then a service, then Drizzle. Errors are thrown as `AppError` and formatted in one place. The auth spec (`docs/superpowers/specs/2026-09-17-auth-design.md`) is the source of truth for auth. This skill pins down everything else.

## Where things live
| Thing | Path |
|---|---|
| Drizzle client | `server/src/db/client.ts` → `export const db`. Driver: `pg` (node-postgres), `drizzle-orm/node-postgres` |
| All tables | `server/src/db/schema.ts` (drizzle-kit reads this one file) |
| `AppError`, `ErrorCode` union, `isUniqueViolation(err)` | `server/src/lib/errors.ts` |
| Guards | `server/src/middleware/requireAuth.ts`, `server/src/middleware/requireRole.ts` (named exports) |
| Feature code | `server/src/<feature>/<feature>.schemas.ts`, `.service.ts`, `.routes.ts` (router is a named export: `<feature>Router`) |
| Router mounting | `server/src/app.ts`: `app.use('/api/<feature>', router)`, placed before `errorHandler` |
| Test helpers | `server/test/helpers.ts`: `createUserWithToken({ role })` |

## Rules
- **Routes:**
  - Parse input inline: `schema.parse(req.body)`, and the same for `req.params` and `req.query`.
  - Call the service and send the response. No DB access and no business logic in routes.
  - Express 5 forwards rejected promises to `errorHandler`, so don't use try/catch or an `asyncHandler` wrapper.
- **Guards:** add them per route with `requireAuth, requireRole('admin')`. Public and admin routes can share a router.
- **Validating ids:** check UUID params with `z.uuid()`. Otherwise Postgres throws and the API returns a 500.
- **Services:**
  - Throw `new AppError(status, code, message)`.
  - Rely on unique constraints: catch the error, check `isUniqueViolation(err)`, and throw a 409 with a specific code (e.g. `SLUG_TAKEN`). Never check first and then insert.
  - A missing record is always `404 NOT_FOUND`. Don't add per-feature not-found codes.
- **New error codes:** add them to the `ErrorCode` union in `lib/errors.ts`. Don't edit the auth spec for them.
- **Responses:**
  - Success: `{ <item> }` for one record, `{ <items> }` for a list, e.g. `{ category }` / `{ categories }`. Create returns 201. A delete or action with no body returns 204.
  - Error: `{ error: { code, message, details? } }`. For `VALIDATION_ERROR`, `details` is `z.flattenError(err).fieldErrors`, i.e. `Record<field, string[]>`.
  - Never return `password_hash`. Map rows to a public shape when they hold anything sensitive.
- **Config:** read settings from `config` (`src/config.ts`), never from `process.env`.
- **Imports:** relative imports end in `.js` (Node ESM).

## New table checklist
1. Add the table to `db/schema.ts`.
2. Run `npm run db:generate -w @app/server`.
3. Read the generated SQL in `server/drizzle/` and commit it with the schema change.
4. Run `npm run db:migrate -w @app/server`. The test database migrates in the global test setup.

No test changes are needed: the test setup clears every table automatically.

## Tests (Vitest + Supertest, real test DB)
- One file per router: `server/test/<feature>.routes.test.ts`.
- Get tokens from `createUserWithToken({ role: 'admin' })`. Don't sign JWTs by hand in tests.
- Insert data for GET tests straight through `db`.
- For each protected route, cover:
  - success
  - 401 with no token
  - 403 with the wrong role
  - 400 with an invalid body or params
  - 404 and 409 where they apply

## Common mistakes
| Mistake | Fix |
|---|---|
| Importing `db` from `db/index.ts` | `db/client.ts` |
| Adding the new table to a TRUNCATE list | Not needed; the setup clears all tables |
| `jsonwebtoken`, `bcrypt`, `dotenv` | `jose`, `crypto.scrypt`, `--env-file` (see the spec) |
| Returning a bare array | Wrap it: `{ categories }` |
