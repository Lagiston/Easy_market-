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
- [x] 3.2 Public product API: list with filtering/sorting/pagination, detail
- [x] 3.3 Product list page with filters (category, price) and sorting
- [x] 3.4 Product detail page (out-of-stock state shown)
- [x] 3.5 Static pages: home/landing, contact info

**Demo:** customer browses products in Arabic with correct RTL layout.

## Phase 4 — Cart, checkout & orders

Goal: customer places a pay-on-delivery order; staff manage it.

- [x] 4.1 Schema: `Order`, `OrderItem`, status enum (received → confirmed → out for delivery → completed / cancelled); order stores fulfillment type (delivery/pickup), a snapshot of the delivery fee charged, a cancel reason (customer unreachable / outside delivery area / customer request / other), a call-attempt count, and a **non-sequential random short order code** used for customer lookup
- [x] 4.2 Cart (client-side state, persisted to localStorage) + cart UI
- [x] 4.3 Checkout: guest form (name, phone, address, delivery/pickup), order placement API with stock validation — no customer accounts in v1. Delivery adds a flat fee (admin-configurable setting) shown in the order total; pickup is free; city-only delivery stated on the form
- [x] 4.3b Phone confirmation: staff call the customer's number to confirm the order — the received → confirmed transition in the dashboard records it. No SMS OTP / no SMS provider in v1
- [x] 4.4 Order confirmation page + order status lookup (order number + phone)
- [x] 4.5 Stock decrement on order placement; restore on cancellation
- [x] 4.6 Dashboard: order list with status filter, order detail, status transitions, cancel
- [x] 4.7 Dashboard overview page: counts of products, orders, low-stock items
- [x] 4.7b Sold-out products chart: daily `ProductStockSnapshot` (count + product ids) taken via a pg-boss cron job just after midnight UTC; `GET /api/dashboard/sold-out-history` returns a 30-day series (`null` for days before tracking started, distinct from a confirmed zero) rendered as a bar chart (`SoldOutChart.tsx`) on the overview page, clicking a day opens `SoldOutProductsDialog.tsx` (`GET /api/dashboard/sold-out-history/:date`) listing that day's sold-out products linked to their product page

**Demo:** end-to-end order — customer checks out, staff confirms and completes it.

## Phase 5 — Inquiries & support inbox (no AI yet)

Goal: the human support pipeline works before AI is layered on.

- [x] 5.1 Schema: `Inquiry` (channel-agnostic `channel` field), `Message`, status/queue fields
- [x] 5.2 Contact/support form on storefront → creates inquiry
- [x] 5.3 Customer chat widget: simple threaded conversation (SSE or polling)
- [x] 5.4 Dashboard inquiry inbox: queues, status filters, assignment
- [x] 5.5 Inquiry detail view: conversation thread, manual reply (sent in customer's language)
- [x] 5.6 Manual escalation/close workflow

**Demo:** customer sends an inquiry from the site; agent replies from the inbox; customer sees the reply.

## Phase 6 — Knowledge base & AI support

Goal: AI classifies inquiries and drafts replies; agents approve every send.

- [x] 6.1 Schema + admin CRUD: `KbArticle` with per-language content
- [x] 6.2 Postgres full-text search over KB articles (per language)
- [x] 6.3 OpenAI integration module (server-side only): client wrapper, error handling, structured outputs
- [x] 6.4 Inquiry classification (GPT-5.6 Luna): topic, product concerned, urgency, confidence → auto-routing to queues
      — new nullable `Inquiry` fields: `aiTopic`/`aiUrgency` (plain strings, core-side constant, no new Prisma enum), `aiConfidence` (`Float?`), `aiProductId` (nullable FK to `Product`, mirrors `assignedAgentId`). No new queue column — "auto-routing" just means the classifier populates `assignedAgentId` itself (e.g. route to whoever's assigned to the concerned product), reusing the existing mine/unassigned/all derivation.
- [x] 6.5 Escalation rules: low confidence, complaints/refunds, "human please" → straight to agent, no draft
      — reuse `Inquiry.escalatedAt` as a general actor-agnostic "needs a human" signal, but decoupled from admin hand-off: the AI path sets `escalatedAt: new Date()` only, leaving `assignedAgentId` untouched (no specific admin to hand off to — stays in the unassigned pool for any agent to claim). The existing staff-facing escalate endpoint is unchanged and keeps requiring an admin, since a person escalating means "hand this to someone specific." Folded into the same 6.4 classification call (one LLM call, not two): the model outputs `escalate: boolean` directly, backstopped by a deterministic `confidence < 0.5` override. Verified live end-to-end against the real OpenAI API: a refund complaint and an explicit "talk to a human" request both correctly escalated, a mundane store-hours question correctly didn't — confirmed visible in the staff inbox via the existing Phase 5 UI with no new client code.
- [x] 6.6 AI reply drafting (GPT-5.6 Luna): retrieve KB candidates via FTS, draft in customer's language
      — reuses the already-anticipated `Message.sender = AI_DRAFT` value; no schema surprise. Chained onto the same fire-and-forget classification flow (6.4/6.5), skipped when the inquiry escalated. Found and fixed a real bug in 6.2's FTS query while testing this live: `plainto_tsquery` ANDs every lexeme, so realistic multi-word customer questions matched nothing against short KB articles — fixed in `kb-search.ts` by OR-ing the parsed terms instead. Verified end-to-end with a real KB article in English and Arabic: correct KB citation via `sourceKbArticleIds`, draft written in the customer's language, no draft created for an escalated complaint, and a sensible generic draft when no KB article matches.
- [x] 6.7 Agent review workflow: view draft with sources, edit, approve/send, or discard and write manually
      — `Message.draftStatus` (new `DraftStatus` enum: PENDING/SENT_UNEDITED/SENT_EDITED/DISCARDED) built together with this task as planned. `InquiryDetailPage.tsx` renders a pending `AI_DRAFT` message as an editable block with resolved KB source titles and Approve/Discard buttons; approving mints a new `STAFF` message with the (possibly edited) text and marks the draft SENT_UNEDITED/SENT_EDITED, never mutating the draft row itself. Race-safe guarded `updateMany` on both new routes (`POST /inquiries/:id/messages/:messageId/{approve,discard}`), 409 if already reviewed. Verified live end-to-end (approve-with-edits mints the correct STAFF message + author, re-approve 409s, discard flips status with no new message) plus 5 new component tests.
- [x] 6.8 Draft-quality tracking: store whether draft was sent unedited / edited / discarded (feeds success metrics)
      — the raw data already existed (`Message.draftStatus`, shipped in 6.7); this task aggregates it into a new `draftSuccessRate` dashboard stat (`GET /api/dashboard/stats`): `groupBy` on `draftStatus` among `AI_DRAFT` messages, rate = (SENT_UNEDITED + SENT_EDITED) / (SENT_UNEDITED + SENT_EDITED + DISCARDED) as a rounded percentage, excluding still-`PENDING` drafts (not yet judged) from the denominator. `null` (not `0`) when nothing's been reviewed yet, rendered as "—" rather than a misleading 0%. Verified live: null with an empty review history, 100% after approving the only reviewed draft.
      — build 6.7 + 6.8 together: add `Message.draftStatus` (nullable, meaningful only on `AI_DRAFT` rows — `PENDING`/`SENT_UNEDITED`/`SENT_EDITED`/`DISCARDED`) up front rather than bolting on 6.8's tracking after 6.7 ships. Approving-with-edits mints a new `STAFF` message with the edited body rather than mutating the draft in place, preserving `Message`'s existing immutability (no `updatedAt`).

**Demo:** inquiry arrives, gets classified and routed, agent approves an AI draft and it's sent.

## Phase 7 — AI product classification

Goal: catalog stays consistently organized with AI help.

- [x] 7.1 Classification endpoint (GPT-5.6 Luna): suggest category + tags from product name/description
- [x] 7.2 Product form integration: suggestions shown on create, staff accept/override
- [x] 7.3 Tags in schema + tag filtering on storefront

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
