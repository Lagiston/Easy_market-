# ES-Market — Tech Stack

TypeScript end-to-end: one language across client and server, with shared types for orders, products, and inquiries.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Shared types across client/server |
| Frontend | React + Vite | Storefront + dashboard as SPA route trees; fast dev loop |
| UI / styling | Tailwind CSS | First-class RTL support (`rtl:` variants) for Arabic; fast to build both storefront and dashboard |
| i18n | i18next (react-i18next) | **English is the primary/default language**; ar, sw, fr as additional locales with English as fallback. RTL direction switching, Arabic plural rules |
| Backend | Bun + Express | Bun as runtime, package manager, and workspace manager (runs TS directly, `--hot` reload, no build step); Express for the REST API |
| ORM / DB | Prisma + PostgreSQL | Relational fits products/orders/inquiries; JSON columns for per-language content fields; Postgres full-text search for the knowledge base |
| Auth | Session cookies, **sessions stored in PostgreSQL** (via Prisma `Session` model) | Seeded admin + staff accounts only, no public signup — simpler and safer than JWT. DB-backed sessions survive server restarts, need no extra infra (no Redis), and allow instant revocation |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/openai`) — OpenAI's "GPT-5.6 Luna" (model id `gpt-5.6-luna`, placeholder — confirm) for both reply drafting and classification/routing | Vercel AI SDK gives a typed, provider-agnostic `generateObject` API for structured outputs (zod schema in, typed object out) plus built-in retry/error handling, instead of hand-rolling JSON-schema parsing against the raw OpenAI SDK |
| Chat / inbox updates | Server-Sent Events (or polling in v1) | Live-ish inquiry inbox and customer chat without WebSocket complexity |
| File uploads | Local disk (product images) | Swap to S3-compatible storage in phase 2 if needed |
| Deployment | Single VPS, Docker Compose (app + Postgres) | One box is plenty for v1; low cost |

## Decisions & rationale

- **SPA + API instead of Next.js.** The dashboard doesn't need SSR, and a plain SPA keeps the mental model simple. If storefront SEO matters at launch, swap the storefront to Next.js and keep the API as-is.
- **AI calls stay server-side.** All AI calls (via the Vercel AI SDK's OpenAI provider) go through our own API endpoints — never from the browser.
- **Knowledge-base retrieval in v1 is Postgres full-text search** to select candidate articles passed into the prompt. No vector DB until draft quality demands it.
- **Authentication uses database-backed sessions.** Session records live in PostgreSQL (a `Session` table managed through Prisma), referenced by an opaque cookie ID — not in-memory or JWT. Sessions survive restarts, can be revoked instantly (e.g., admin disables an agent account), and add no infrastructure beyond the existing database.
- **Inquiries are channel-agnostic** (`channel` field in the schema), so phase-2 WhatsApp/Instagram integrations become new ingestion routes into the same pipeline.
