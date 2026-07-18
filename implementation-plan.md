# ES-Market — Implementation Plan

Phases build on each other; each ends with something demoable. Tasks are sized to be one focused work session each. Stack per [tech-stack.md](tech-stack.md); scope per [Project-Scope.md](Project-Scope.md).

## Phase 1 — Foundation

Goal: repo scaffold, database, and staff auth working end-to-end.

- [ ] 1.1 Scaffold monorepo: `client/` (Vite + React + TS) and `server/` (Express + TS), shared lint/format config
- [ ] 1.2 Docker Compose for local PostgreSQL; server `.env` handling
- [ ] 1.3 Prisma setup + initial schema: `User` (role: ADMIN/AGENT), `Session`
- [x] 1.4 Session auth: login/logout endpoints, DB-backed sessions (opaque cookie ID), auth + role middleware
- [x] 1.5 Seed script: seeded admin account
- [x] 1.6 Dashboard shell: login page, protected layout with nav, logout
- [ ] 1.7 User management (admin): list/create/deactivate staff accounts, change password

**Demo:** admin logs in, creates an agent account; agent logs in.

## Phase 2 — Catalog

Goal: staff manage products; data model supports 4 languages.

- [x] 2.1 Schema: `Product`, `Category`, per-language content (JSON fields for name/description: en/ar/sw/fr; **English required, others optional with English fallback**), stock fields
- [x] 2.2 Product CRUD API with validation
- [x] 2.3 Product image upload (local disk) + serving
- [x] 2.4 Dashboard: product list with search/filter, low-stock flag
- [x] 2.5 Dashboard: product create/edit form with per-language tabs, category picker, stock quantity
- [x] 2.6 Category management (admin)

**Demo:** admin creates a bilingual product with an image and stock level.

## Phase 3 — Storefront

Goal: customers browse the catalog in their language.

- [x] 3.1 Storefront shell: layout, i18next setup (English default, ar/sw/fr with English fallback), language switcher, RTL for Arabic
- [ ] 3.2 Public product API: list with filtering/sorting/pagination, detail
- [x] 3.3 Product list page with filters (category, price) and sorting
- [ ] 3.4 Product detail page (out-of-stock state shown)
- [ ] 3.5 Static pages: home/landing, contact info

**Demo:** customer browses products in Arabic with correct RTL layout.

## Phase 4 — Cart, checkout & orders

Goal: customer places a pay-on-delivery order; staff manage it.

- [ ] 4.1 Schema: `Order`, `OrderItem`, status enum (received → confirmed → out for delivery → completed / cancelled); order stores fulfillment type (delivery/pickup), a snapshot of the delivery fee charged, a cancel reason (customer unreachable / outside delivery area / customer request / other), a call-attempt count, and a **non-sequential random short order code** used for customer lookup
- [ ] 4.2 Cart (client-side state, persisted to localStorage) + cart UI
- [ ] 4.3 Checkout: guest form (name, phone, address, delivery/pickup), order placement API with stock validation — no customer accounts in v1. Delivery adds a flat fee (admin-configurable setting) shown in the order total; pickup is free; city-only delivery stated on the form
- [ ] 4.3b Phone confirmation: staff call the customer's number to confirm the order — the received → confirmed transition in the dashboard records it. No SMS OTP / no SMS provider in v1
- [ ] 4.4 Order confirmation page + order status lookup (order number + phone)
- [ ] 4.5 Stock decrement on order placement; restore on cancellation
- [ ] 4.6 Dashboard: order list with status filter, order detail, status transitions, cancel
- [ ] 4.7 Dashboard overview page: counts of products, orders, low-stock items

**Demo:** end-to-end order — customer checks out, staff confirms and completes it.

## Phase 5 — Inquiries & support inbox (no AI yet)

Goal: the human support pipeline works before AI is layered on.

- [ ] 5.1 Schema: `Inquiry` (channel-agnostic `channel` field), `Message`, status/queue fields
- [ ] 5.2 Contact/support form on storefront → creates inquiry
- [ ] 5.3 Customer chat widget: simple threaded conversation (SSE or polling)
- [ ] 5.4 Dashboard inquiry inbox: queues, status filters, assignment
- [ ] 5.5 Inquiry detail view: conversation thread, manual reply (sent in customer's language)
- [ ] 5.6 Manual escalation/close workflow

**Demo:** customer sends an inquiry from the site; agent replies from the inbox; customer sees the reply.

## Phase 6 — Knowledge base & AI support

Goal: AI classifies inquiries and drafts replies; agents approve every send.

- [ ] 6.1 Schema + admin CRUD: `KbArticle` with per-language content
- [ ] 6.2 Postgres full-text search over KB articles (per language)
- [ ] 6.3 OpenAI integration module (server-side only): client wrapper, error handling, structured outputs
- [ ] 6.4 Inquiry classification (GPT-5 mini): topic, product concerned, urgency, confidence → auto-routing to queues
- [ ] 6.5 Escalation rules: low confidence, complaints/refunds, "human please" → straight to agent, no draft
- [ ] 6.6 AI reply drafting (GPT-5): retrieve KB candidates via FTS, draft in customer's language
- [ ] 6.7 Agent review workflow: view draft with sources, edit, approve/send, or discard and write manually
- [ ] 6.8 Draft-quality tracking: store whether draft was sent unedited / edited / discarded (feeds success metrics)

**Demo:** inquiry arrives, gets classified and routed, agent approves an AI draft and it's sent.

## Phase 7 — AI product classification

Goal: catalog stays consistently organized with AI help.

- [ ] 7.1 Classification endpoint (GPT-5 mini): suggest category + tags from product name/description
- [ ] 7.2 Product form integration: suggestions shown on create, staff accept/override
- [ ] 7.3 Tags in schema + tag filtering on storefront

**Demo:** staff types a product description; category and tags appear pre-filled.

## Phase 8 — Polish & launch

Goal: production-ready.

- [ ] 8.1 Translate all storefront UI strings (en/ar/sw/fr); verify RTL across every page
- [ ] 8.2 Security pass: rate limiting, input validation sweep, security headers, upload restrictions
- [ ] 8.3 Metrics dashboard: first-response time, % drafts approved with little/no edit, orders/week
- [ ] 8.4 Production Docker Compose (app + Postgres), backups, deploy to VPS
- [ ] 8.5 Seed real content: initial categories, KB articles, launch products — in English and Arabic (priority languages); Swahili/French content follows post-launch
- [ ] 8.6 End-to-end smoke test of all flows in all languages

**Demo:** live site.

## Open questions to resolve (from Project-Scope.md)

Resolve before the phase that needs them:

- ~~Guest checkout vs. customer accounts~~ → **Resolved: guest checkout with phone confirmation** (customer accounts are a phase 2 candidate)
- ~~Delivery zones/fees/logistics~~ → **Resolved: self-delivery within the city, flat fee** (pickup free). Fee amount stored as a config setting
- ~~Which two languages to prioritize for content entry~~ → **Resolved: English first, Arabic second.** Content (products, KB) is entered in English + Arabic at launch; Swahili and French follow as capacity allows
