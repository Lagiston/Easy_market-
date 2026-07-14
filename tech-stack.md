# ES-Market Tech Stack

Decisions recorded here; update when a choice changes.

## Frontend (`client/`)

- Vite + React 19 + TypeScript
- React Router (routing), TanStack Query (server state)
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- react-i18next — EN / AR / SW / FR, RTL for Arabic (wired up from M2/M5)

## Backend (`server/`)

- Express 5 + TypeScript (ESM, run with `tsx`)
- PostgreSQL (local Homebrew install; DB `es_market`)
- Prisma 7 with `@prisma/adapter-pg` driver adapter; config in `prisma.config.ts`; client generated to `server/src/generated/prisma`
- Zod for request validation
- bcryptjs for password hashing (pure JS — native bcrypt blocked by npm allow-scripts)

## Auth

- Database sessions: `Session` table (opaque random token, expiry), httpOnly `session` cookie, `sameSite=lax`
- Seeded admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env (`npx prisma db seed`); `mustChangePassword` forces a new password on first login and applies to all admin-created users
- Roles: `ADMIN`, `AGENT`

## AI (from M2/M4)

- OpenAI API — structured outputs for inquiry/product classification, chat completions for reply drafts

## Email (from M4)

- SendGrid — outbound replies via Send API; inbound customer replies via Inbound Parse webhook (`POST /api/webhooks/email-inbound`), matched to inquiries by tokenized reply-to address

## Dev workflow

- `client` dev server proxies `/api` and `/uploads` to `http://localhost:4000` (no CORS)
- Product images: local disk `server/uploads/` served statically (v1)
- Tests: Vitest + Supertest on the API's money paths
