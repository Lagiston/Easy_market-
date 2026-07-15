# ES-Market

AI-powered e-commerce site + internal dashboard for a physical store. Customers browse and order online (pay on delivery/pickup); staff manage the catalog, orders, and an AI-assisted support inbox where every AI-drafted reply is reviewed by an agent before sending.

## Key documents

- [Project-Scope.md](Project-Scope.md) — problem, features, scope decisions, resolved open questions
- [tech-stack.md](tech-stack.md) — stack choices and rationale
- [implementation-plan.md](implementation-plan.md) — phased task breakdown; keep checkboxes updated as tasks complete

## Stack

Bun workspaces monorepo: `client/` (Vite + React + TypeScript) and `server/` (Express 5 + TypeScript, runs natively on Bun — no build step). PostgreSQL via Prisma. OpenAI API for AI features (server-side only, never from the browser).

## Commands

```sh
bun install              # install all workspace deps (from root)
bun run dev:server       # Express on Bun with --hot, http://localhost:3000
bun run dev:client       # Vite dev server, http://localhost:5173 (proxies /api to :3000)
bun run --cwd server typecheck   # tsc --noEmit
```

## Documentation lookups

Use the **context7 MCP server** to fetch up-to-date docs before working with any library, framework, or API (Bun, Express, Vite, React, Prisma, i18next, OpenAI, …) — resolve the library ID first, then query. Training data may be stale; prefer context7 over memory or web search for library usage.

## Conventions & decisions

- **Auth:** DB-backed sessions (Prisma `Session` model, opaque cookie ID) — no JWT, no in-memory sessions. Staff accounts only (ADMIN/AGENT roles), no public signup; admin is seeded.
- **Languages:** English is primary/required; Arabic, Swahili, French optional with English fallback. Arabic needs RTL. Launch content is entered in English + Arabic only.
- **Checkout:** guest only, no customer accounts in v1. Staff phone-call confirmation (no SMS OTP). Self-delivery, city-only, flat fee (admin-configurable).
- **Orders:** non-sequential random order codes for customer status lookup (code + phone).
- **Inquiries:** channel-agnostic `channel` field from day one (WhatsApp/Instagram are phase 2).
- **AI:** GPT-5 for reply drafting, GPT-5 mini for classification; structured outputs (JSON schema). Every AI reply requires agent approval before sending.
