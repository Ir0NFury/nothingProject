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
- **Auth:** JWT access token + refresh token (details below)
- **Undecided:** ORM (Prisma or Drizzle), UI library, hosting

## Auth design (decided)
- **Access token:** short-lived JWT (~15 min), sent as an `Authorization: Bearer` header. The client keeps it in memory only, never in localStorage.
- **Refresh token:** long-lived (~7–30 days), kept in an `httpOnly`, `Secure`, `SameSite` cookie named `ip_refresh`, with path limited to `/api/auth`. Use unique cookie names, because other localhost apps set `refreshToken` / `JSESSIONID`.
- **Rotation:** every refresh issues a new refresh token and invalidates the old one. Refresh tokens are stored hashed in the DB. Reuse of an already-rotated token revokes that token family.
- **Client:** the API client catches a 401, runs a single shared refresh call (even when several requests fail at once), then retries.
- **Roles:** `user` and `admin`, carried in the access token claims and checked server-side.

## MVP scope
1. **Public pages:** categories (e.g. React basics, JavaScript, Node.js), each with a list of questions and answers. Answers are Markdown with syntax-highlighted code examples.
2. **Admin panel:** `/admin` in the same React app, restricted to users with the `admin` role. Create and edit categories, questions, answers and code examples.
3. **Auth:** register, login, and roles (`user`, `admin`).

**Later:** AI features (question generation, answer grading, mock interviewer, RAG), tests, and deploy with CI/CD.

## Structure (planned)
```
client/   React app
server/   Express API
shared/   Types shared by client and server (added when needed)
```

## Commands (run from repo root)
- `npm run dev`: starts server (tsx watch) and client (Vite) together
- `npm run build`: builds both workspaces
- `npm run typecheck`: runs tsc for server and client
- `npm run lint -w @app/client`: oxlint
- Run a command in one workspace: `npm run <script> -w @app/server` (or `@app/client`)

## Local ports
- Client (Vite): 5173. It proxies `/api/*` to the server.
- Server (Express): 4000 (override with `PORT`)
- Ports 3000 and 5432 are already taken on the dev machine by other Docker containers. Use a different host port for Postgres (e.g. 5433).

## Conventions
- TypeScript everywhere, `strict` mode.
- Validate API input at the boundary (Zod).
- Secrets live in `.env` files, which are never committed. `.env.example` documents the variables.
- Commits are small and focused, with an imperative subject line.
