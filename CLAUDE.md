# nothingProject: Interview Prep App

Full-stack app for preparing for technical interviews. It is also a learning project: the owner is a senior React developer learning Node.js, backend, AI engineering and deployment.

## Working agreement
- Build step by step. Scope each change small and agree on it before writing large amounts of code.
- Explain backend, database, infra and AI concepts when they first come up. Skip React basics.
- Prefer clear, conventional code over clever abstractions. This codebase is also study material.
- Don't add dependencies without saying why.

## Stack
- **Monorepo:** npm workspaces (no Nx or Turborepo)
- **client/:** React + TypeScript + Vite
- **server/:** Node.js + TypeScript + Express
- **Database:** PostgreSQL, run locally in Docker
- **ORM:** Drizzle (drizzle-orm + drizzle-kit, pg driver). Migrations in server/drizzle/, committed.
- **Auth:** JWT access token + refresh token (details below)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`. No config file: the import and base styles live in `client/src/index.css`.
- **Undecided:** component library (e.g. shadcn/ui), hosting

## Auth design (decided)
- **Access token:** short-lived JWT (15 min), HS256, claims `sub`, `role`, `iat`, `exp`. Sent as `Authorization: Bearer` header; client keeps it in memory only, never in localStorage.
- **Refresh token:** 7-day lifetime, kept in an `httpOnly`, `SameSite=Strict` cookie named `ip_refresh`, with path limited to `/api/auth`. `Secure` flag only in production. Use unique cookie names, because other localhost apps set `refreshToken` / `JSESSIONID`.
- **Rotation:** every refresh issues a new refresh token and invalidates the old one. Refresh tokens are stored hashed in the DB. Reuse of an already-rotated token revokes that token family.
- **Concurrency:** refresh and logout lock the user's row (`SELECT … FOR UPDATE`) before touching that user's tokens, so reuse revocation can't miss a token that a parallel refresh is inserting.
- **Known trade-off:** if a refresh response is lost after the server rotated the token (tab closed or reloaded mid-request), the browser keeps the old cookie, the next refresh looks like reuse, and the user is logged out. A short reuse grace window could soften this later (not implemented).
- **Rate limit:** login and register share a limit of 10 requests per 15 minutes per IP (off in tests). Set Express `trust proxy` when deploying behind a reverse proxy, or every client shares one limit.
- **Client structure:** `api/client.ts` owns the access token (memory only) and the refresh logic; `auth/AuthProvider` owns the current user; components use `useAuth()` and never touch tokens.
- **Roles:** `user` and `admin`, carried in the access token claims and checked server-side.

## MVP scope
1. **Public pages:** categories (e.g. React basics, JavaScript, Node.js), each with a list of questions and answers. Answers are Markdown with syntax-highlighted code examples.
2. **Admin panel:** `/admin` in the same React app, restricted to users with the `admin` role. Create and edit categories, questions, answers and code examples.
3. **Auth:** register, login, and roles (`user`, `admin`).

**Later:** AI features (question generation, answer grading, mock interviewer, RAG), more tests, and deploy with CI/CD.

## Structure
```
client/              React app (src/api, src/auth, src/components, src/pages)
server/              Express API (src/auth, src/admin, src/categories, src/db, src/lib, src/middleware)
server/drizzle/      SQL migrations (generated, committed)
server/test/         Vitest + Supertest tests (use the interview_prep_test DB)
docker-compose.yml   Postgres 17 on host port 5433
docs/                Specs and plans
shared/              Types shared by client and server (added when needed)
```

## Commands (run from repo root)
- `npm run dev`: starts server (tsx watch) and client (Vite) together. Requires `server/.env`; without it the server exits and lists the missing or invalid variables.
- `npm run build`: builds both workspaces
- `npm run typecheck`: runs tsc for server and client
- `npm run lint -w @app/client`: oxlint
- `npm run test`: server + client tests (server tests need `db:up`)
- `npm run db:up` / `npm run db:down`: start/stop Postgres (Docker, host port 5433)
- `npm run db:generate -w @app/server`: generate a migration from `src/db/schema.ts`
- `npm run db:migrate -w @app/server`: apply migrations to the dev DB
- `npm run db:seed-admin -w @app/server`: create/update the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
- `npm run db:seed-categories -w @app/server`: insert the starter categories that are missing (never overwrites existing rows)
- Run a command in one workspace: `npm run <script> -w @app/server` (or `@app/client`)

## First-time setup
```bash
cp server/.env.example server/.env
# Edit server/.env: set JWT_ACCESS_SECRET (≥32 chars) and ADMIN_EMAIL / ADMIN_PASSWORD before seeding;
# without a valid server/.env the server exits and lists the missing or invalid variables
npm run db:up
npm run db:migrate -w @app/server
npm run db:seed-admin -w @app/server
npm run db:seed-categories -w @app/server
npm run dev
```

## Local ports
- Client (Vite): 5173. It proxies `/api/*` to the server.
- Server (Express): 4000 (override with `PORT`)
- Postgres: 5433 (host port; container port 5432). Ports 3000 and 5432 are already taken on the dev machine by other Docker containers.

## Conventions
- TypeScript everywhere, `strict` mode.
- Validate API input at the boundary (Zod).
- Secrets live in `.env` files, which are never committed. `.env.example` documents the variables.
- Commits are small and focused, with an imperative subject line.
