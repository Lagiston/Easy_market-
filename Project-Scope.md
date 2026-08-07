# Halatu — AI-Powered E-Commerce & Customer Support System

## Problem

Halatu is a physical store selling a variety of goods. Two problems limit growth:

1. **No online presence.** Customers can only browse and buy in-store; the business wants to expand by selling through a website.
2. **Slow, impersonal customer support.** Hundreds of orders and inquiries arrive daily. An agent manually reads each message, figures out which product it concerns, and writes a response. This is slow, and the pressure to keep up leads to canned, impersonal replies.

## Solution

Build the Halatu e-commerce website with an internal dashboard, using AI in two distinct ways:

1. **AI product classification** — when staff add a product, AI automatically suggests its category and tags, keeping the catalog consistently organized.
2. **AI-assisted customer support** — incoming customer inquiries are automatically classified and routed, and AI drafts a personalized reply from a knowledge base. **An agent reviews, edits, and approves every reply before it is sent** (human-in-the-loop). Complex or sensitive cases are escalated directly to agents.

The result: customers get faster, more personalized responses and can order online; agents spend their time on complex issues instead of routine replies.

## Scope decisions

| Decision | v1 choice | Notes |
|---|---|---|
| Checkout | Order online, **pay on delivery/pickup** | No payment gateway in v1; add online payments in phase 2 |
| AI reply autonomy | Agent approves every AI-drafted reply | Revisit auto-send for high-confidence cases after measuring draft quality |
| Support channels | **Website only** (form/chat) | WhatsApp and Instagram/Facebook in phase 2; inquiry data model is channel-agnostic (`channel` field) from day one |
| Inventory | Manual stock updates in dashboard | Staff decrement stock for in-store sales; low-stock flag and out-of-stock state mitigate overselling risk. POS integration is a possible phase 2 |
| Languages | English, Arabic, Swahili, French | Storefront UI, product content, knowledge base, and AI replies. Arabic requires RTL layout support |
| Dashboard roles | **Admin** and **Agent** | Admin: products, users, knowledge base. Agent: inquiry queue and reply approval |
| Staff onboarding | System deploys with a seeded admin account | The admin then creates agent (and additional admin) accounts from the dashboard; there is no public staff signup |

## Features

### Storefront (customer-facing)

- Product list with filtering and sorting
- Product detail view
- Cart and checkout — place an order with pay-on-delivery/pickup (no online payment)
- Order confirmation and status tracking (e.g., received → confirmed → out for delivery → completed / cancelled)
- Contact/support form and chat for inquiries
- Multilingual UI: English, Arabic (RTL), Swahili, French — customer picks a language; product content shown in that language

### Support & AI (internal)

- Inquiry inbox: receive, view, and manage all customer inquiries
- AI classification of inquiries (topic, product concerned, urgency) and routing to the right queue
- AI-suggested replies generated from the knowledge base, in the customer's language
- Agent review workflow: edit, approve/send, or escalate each AI draft
- Escalation rules: low AI confidence, complaints/refunds, or customer requests a human → route straight to an agent
- Knowledge base management (admin): create and edit articles used by the AI, per language

### Catalog & dashboard (internal)

- Create and manage products (with per-language name/description fields)
- AI-powered product classification: suggested category and tags on product creation, staff can override
- Manual inventory management: stock quantities, low-stock flag, out-of-stock handling on storefront
- Order management: view, confirm, update status, cancel orders
- Dashboard overview of products, orders, and inquiries
- User management (admin only): the system is deployed with a seeded admin account; the admin creates agent (and additional admin) accounts — no public staff signup

## Out of scope for v1 (phase 2 candidates)

- Online payment gateway
- WhatsApp Business API integration
- Instagram/Facebook messaging integration
- POS/inventory system integration
- Auto-sending AI replies without agent approval

## Open questions

- ~~Customer accounts vs. guest checkout~~ **Resolved: guest checkout for v1 — staff call the customer's phone to confirm each order (no SMS OTP); customer accounts are a phase 2 candidate.** Details:
  - Unreachable customers: after 3 failed call attempts within 24h, the order is cancelled with reason "customer unreachable" and stock is restored; call attempts are recorded on the order
  - Order numbers are non-sequential random short codes, so order status lookup (code + phone) can't be enumerated
  - The confirmation call doubles as the fraud filter; the order endpoint is also rate-limited per IP/phone
  - Revisit: if volume exceeds ~50 orders/day, consider auto-confirming repeat customers (known phone numbers) instead of calling every order
- ~~Delivery logistics: who delivers, delivery zones, and fees~~ **Resolved: Halatu delivers with its own staff, within the city only, for a flat delivery fee (pickup remains free). Fee amount is a config value; out-of-city delivery is out of scope for v1.** Details:
  - City-only is enforced by staff during the confirmation call (cancel reason "outside delivery area") — no geo/zone validation built in v1
  - Free delivery above a configurable order-total threshold (admin setting, alongside the flat fee)
  - Delivery expectation shown at checkout and on the confirmation page: delivered within 24–48h in-city
- ~~Which two languages to prioritize for content entry at launch if translating everything is too slow~~ **Resolved: English (primary) and Arabic; Swahili and French content follows post-launch.** Details:
  - All four languages remain selectable at launch (UI strings are translated in all four); product/KB *content* not yet translated falls back to English with a small "shown in English" note, so the sw/fr experience doesn't look broken
  - AI-drafted replies cover **all four languages** regardless of KB content language — the AI drafts in the customer's language even from an English/Arabic KB article. Content-entry priority and AI reply coverage are separate things

## Success metrics

- Median first-response time to customer inquiries (target: minutes, not hours)
- % of inquiries resolved from an approved AI draft with little or no editing
- Orders placed through the website per week
- Agent time freed for complex issues (inquiries handled per agent per day)
