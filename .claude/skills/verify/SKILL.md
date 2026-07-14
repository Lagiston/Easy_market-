---
name: verify
description: Build, launch, and drive ES-Market (Vite client + Express API) to verify changes end-to-end.
---

# Verifying ES-Market

## Launch

- Postgres: Homebrew service `postgresql@18`, DB `es_market` (`pg_isready` to check).
- API: `cd server && npm run dev` → http://localhost:4000 (`/api/health` returns `{"ok":true}`). Needs `server/.env` (DATABASE_URL etc.).
- Client: `cd client && npm run dev` → http://localhost:5173, proxies `/api` and `/uploads` to :4000.
- Reset users to clean state: delete rows then `npx prisma db seed` (admin from ADMIN_EMAIL/ADMIN_PASSWORD in `server/.env`, `mustChangePassword=true`).

## Drive (GUI)

Playwright is installed globally (`npm root -g`) with Chromium. ESM scripts can't
use NODE_PATH — symlink instead:

```bash
cd <scratchpad> && mkdir -p node_modules && ln -sf $(npm root -g)/playwright node_modules/playwright
node script.mjs
```

## Flows worth driving

- Login at `/dashboard/login` → seeded admin is forced to `/dashboard/change-password` before anything else.
- Admin creates agents under `/dashboard/users`; new users are also forced to change password on first login.
- Agents must NOT see the Users nav item or reach `/api/users` (403).

## Gotchas

- Password inputs on the change-password page: select by `input[type=password]` nth(0..2).
- Seeded admin credentials come from `server/.env`; verification scripts that change the password must reset users + re-seed afterwards.
