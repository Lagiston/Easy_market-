# ES-Market

AI-powered e-commerce site + internal dashboard for a physical store. Customers browse and order online (pay on delivery/pickup); staff manage the catalog, orders, and an AI-assisted support inbox where every AI-drafted reply is reviewed by an agent before sending.

## Key documents

- [Project-Scope.md](Project-Scope.md) — problem, features, scope decisions, resolved open questions
- [tech-stack.md](tech-stack.md) — stack choices and rationale
- [implementation-plan.md](implementation-plan.md) — phased task breakdown; keep checkboxes updated as tasks complete

## Stack

Bun workspaces monorepo: `client/` (Vite + React + TypeScript) and `server/` (Express 5 + TypeScript, runs natively on Bun — no build step). PostgreSQL via Prisma. OpenAI API for AI features (server-side only, never from the browser). Client UI: Tailwind CSS v4 + shadcn/ui.

## Commands

```sh
bun install              # install all workspace deps (from root)
bun run dev:server       # Express on Bun with --hot, http://localhost:3000
bun run dev:client       # Vite dev server, http://localhost:5173 (proxies /api to :3000)
bun run --cwd server typecheck   # tsc --noEmit
```

## Authentication

Better Auth (email/password) with the Prisma adapter on PostgreSQL — DB-backed sessions with an opaque cookie ID (no JWT). Staff accounts only: public signup is disabled (`disableSignUp: true`); the admin is seeded and creates other accounts.

- **Server config:** `server/src/lib/auth.ts`. The handler is mounted in `server/src/index.ts` at `app.all("/api/auth/*splat", toNodeHandler(auth))` — this must stay **before** `express.json()`, or Better Auth requests will hang on the consumed body.
- **Roles:** `role` is a Better Auth additional field on `user` (default `"AGENT"`, `input: false` so clients can't set it); the Prisma `Role` enum is `ADMIN | AGENT`.
- **Route protection:** `server/src/middleware/require-auth.ts` exports `requireAuth` (401s if no session, then populates `req.user`/`req.session`) and `requireRole(...roles)` (403s otherwise). Example: `app.get("/api/me", requireAuth, ...)`.
- **Client:** `client/src/lib/auth-client.ts` creates `authClient` from `better-auth/react`, with `inferAdditionalFields` so `role` is typed on the session user (exported as `SessionUser`). Same-origin: Vite proxies `/api` to :3000, so no `baseURL` is set. Use `authClient.useSession()` for auth state, `authClient.signIn.email()` / `authClient.signOut()` for flows; `ProtectedRoute` redirects unauthenticated users to `/login` and takes an optional `roles` prop for role-gated routes (e.g. `<ProtectedRoute roles={["ADMIN"]} />` wraps `/users`; disallowed roles are redirected to `/`). Role-only UI (like the "Users" nav link in `Layout`) checks `user.role`. Client gating is UX only — protect the matching API routes with `requireRole` too.
- **Admin seeding:** `bun run --cwd server seed` (also wired as the Prisma seed) — idempotent, reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`, hashes with `better-auth/crypto` under the `credential` provider.
- **Env vars** (`server/.env`, see `.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (:3000), `CLIENT_URL` (:5173, listed in `trustedOrigins`), plus the `ADMIN_*` seed vars.

## Documentation lookups

Use the **context7 MCP server** to fetch up-to-date docs before working with any library, framework, or API (Bun, Express, Vite, React, Prisma, i18next, OpenAI, …) — resolve the library ID first, then query. Training data may be stale; prefer context7 over memory or web search for library usage.

## Conventions & decisions

- **Auth:** DB-backed sessions (Prisma `Session` model, opaque cookie ID) — no JWT, no in-memory sessions. Staff accounts only (ADMIN/AGENT roles), no public signup; admin is seeded. See the Authentication section above for implementation details.
- **Languages:** English is primary/required; Arabic, Swahili, French optional with English fallback. Arabic needs RTL. Launch content is entered in English + Arabic only.
- **Checkout:** guest only, no customer accounts in v1. Staff phone-call confirmation (no SMS OTP). Self-delivery, city-only, flat fee (admin-configurable).
- **Orders:** non-sequential random order codes for customer status lookup (code + phone).
- **Inquiries:** channel-agnostic `channel` field from day one (WhatsApp/Instagram are phase 2).
- **Styling:** Tailwind v4 utilities + shadcn components only — no custom CSS files or inline styles. shadcn is set up with the nova preset, neutral base, CSS variables, and RTL enabled (`client/components.json`); add components with `bunx shadcn@latest add <name>` from `client/`. Use theme tokens (`bg-muted`, `text-destructive`, `bg-primary`, …), not hardcoded palette colors. Brand primary is a dark forest green (oklch hue 152, defined in `client/src/index.css`).
- **AI:** GPT-5 for reply drafting, GPT-5 mini for classification; structured outputs (JSON schema). Every AI reply requires agent approval before sending.
