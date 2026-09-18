---
name: run-and-verify
description: Use when starting this app locally, or when confirming a change works in a real browser (login, roles, admin pages, end-to-end checks) instead of only in tests.
---

# Running and verifying this app (browser checks)

## Overview
Three processes: Postgres in Docker, the Express API, and Vite. Tests run against their own database; browser checks run against the dev one. All commands below are from the repo root unless stated.

## Start the stack
| Step | Command | Notes |
|---|---|---|
| Database | `npm run db:up` | Postgres 17 on host port **5433** (5432 and 3000 are taken by other containers) |
| Migrations | `npm run db:migrate -w @app/server` | only after a schema change, or on a fresh volume |
| App | `npm run dev` | API on 4000 (tsx watch), client on 5173 (proxies `/api`) |

`npm run dev` needs `server/.env`; without it the server prints the invalid variables and exits. Claude must never read or write that file, so start the API with values inline instead — same for any script that would use `--env-file`:

```bash
cd server && DATABASE_URL=postgres://app:app@localhost:5433/interview_prep \
  JWT_ACCESS_SECRET=dev-only-secret-dev-only-secret-dev-only npx tsx watch src/index.ts
# client: npm run dev -w @app/client
```

Wait for readiness by polling, never by sleeping: `until curl -sf localhost:5173/api/health; do sleep 0.5; done`.

## Get a user to log in as
- **Admin:** run the seed script with the inline env above plus `ADMIN_EMAIL=... ADMIN_PASSWORD=...`, e.g. `cd server && DATABASE_URL=… JWT_ACCESS_SECRET=… ADMIN_EMAIL=e2e-admin@example.com ADMIN_PASSWORD=e2e-admin-password npx tsx src/db/seed-admin.ts`. It creates or updates that user and gives it the `admin` role.
- **Normal user:** register through the UI; new accounts get the `user` role.
- **Roles live inside the access token.** Changing `users.role` with SQL shows nothing until the page reloads — the reload's `/api/auth/refresh` re-reads the row and mints a new token. Reload; a re-login is not needed.

## Drive the browser
`chromium-cli` is not installed here, and `playwright-core` is not in the repo's `node_modules`. Install it in your scratchpad directory first — never add it to the repo's `package.json`:

```bash
mkdir -p "$SCRATCHPAD/e2e" && cd "$SCRATCHPAD/e2e"
npm init -y >/dev/null && npm i playwright-core   # Chrome itself is already installed
```

Then write the script next to it and run it with `node` from that directory:

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await (await browser.newContext()).newPage()
page.on('pageerror', (err) => { throw err })
await page.goto('http://localhost:5173/login')
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password').fill(password)
await page.getByRole('button', { name: 'Log in' }).click()
const nav = page.getByRole('navigation', { name: 'Main' })
await nav.getByRole('link', { name: 'Admin' }).click()   // admins only
await page.getByText('Server says admin access is OK.').waitFor()
await page.screenshot({ path: 'admin.png' })
```

Selectors come from the markup, not test ids: the nav is `nav[aria-label="Main"]`, and forms use the labels Email and Password with buttons "Log in" / "Register". The two kinds of error look different: a **form-level** error is `<p role="alert" class="form-error">`, while a **field** error is `<p id="…-error" class="field-error">` with no role, linked from the input's `aria-describedby` (the input also gets `aria-invalid`). Prefer `waitFor` over timeouts.

## Gotchas
| Thing | What to know |
|---|---|
| Reading too early | Renders lag the event that triggers them: `waitForURL` then `innerText()` returns the previous page, and reading a field error straight after clicking submit runs before React re-renders. Always wait for the element or text you expect, then read. |
| Rate limit | `/login` and `/register` **share** 10 requests per 15 minutes per IP. Re-running a script hits 429, which looks like a bug. Budget the calls; restart the API to reset the counter. |
| Console 401s | Every guest page load calls `/api/auth/refresh` and gets a 401, which Chrome logs as "Failed to load resource". Expected. Assert the status per URL instead of failing on every console error. |
| Databases | Browser checks and the seed script use `interview_prep`; tests use `interview_prep_test` and truncate it before each test. Never point tests at the dev database. |
| Cleanup | Delete rows you create: `docker compose exec -T postgres psql -U app -d interview_prep -c "delete from users where email like 'e2e-%'"` (refresh tokens cascade). |
| Known bug | Logging out from a protected page lands on `/login` instead of `/`. |

## Common mistakes
| Mistake | Fix |
|---|---|
| Starting the API with `npm run dev` and getting `.env`-related failures | Pass the values inline (above) |
| "The SQL role change didn't work" | Reload the page — the role is baked into the access token |
| Treating an expected 4xx as a failure | Guest 401s and negative-path 400/401/409 are part of the flows you are testing |
| A screenshot that renders but shows no data | Check the API directly (`curl localhost:5173/api/health`) and read the server log |
