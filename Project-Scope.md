# ES-Market — AI-Powered E-Commerce & Customer Support System

## Problem

ES-Market (Easy Shopping Market) is a physical store selling a variety of goods. Two problems limit growth:

1. **No online presence.** Customers can only browse and buy in-store.
2. **Manual customer support doesn't scale.** Hundreds of orders and inquiries arrive daily. An agent manually reads each message, figures out which product it concerns, and writes a response — slow, and the pressure leads to impersonal, canned replies.

## Solution

Build the ES-Market e-commerce website with an internal management system that uses AI in two ways:

1. **Customer inquiry triage** — AI classifies incoming customer messages, drafts personalized replies from a knowledge base, and routes complex issues to human agents. Agents review and approve every AI draft before it is sent.
2. **Product classification** — AI auto-categorizes and tags products as they are added to the catalog.

This delivers faster, more personal responses while freeing agents for complex issues.

## Scope decisions (v1)

| Area | Decision |
|---|---|
| Checkout | Customers browse, add to cart, and place orders online; **payment on delivery/pickup** — no payment gateway in v1 |
| AI autonomy | **Human-in-the-loop**: AI drafts replies; an agent edits/approves before sending |
| Channels | **Website only** (form/chat). WhatsApp and Instagram/Facebook are Phase 2, but the inquiry data model is channel-agnostic (each inquiry records its `channel`) so new channels plug in without a rewrite |
| Inventory | **Manual stock updates** in the dashboard. Storefront shows out-of-stock state and dashboard flags low stock to reduce overselling risk |
| Roles | **Admin** (products, users, knowledge base) and **Agent** (inquiry queue, reply approval) |
| Provisioning | System is deployed with a **seeded admin account**; the admin creates agent accounts from the dashboard — no self-registration for staff |
| Languages | **English, Arabic, Swahili, French** — storefront UI, product content, knowledge base, and AI replies. Arabic requires RTL layout support |

## Features

### Storefront (customer-facing)

- Product list with filtering and sorting
- Product detail view
- Cart and checkout (pay on delivery/pickup)
- Order confirmation and status tracking (placed → confirmed → out for delivery / ready for pickup → completed / cancelled)
- Contact form / chat widget for inquiries
- Language switcher (EN / AR / SW / FR) with RTL support for Arabic

### AI — customer inquiries

- Receive customer inquiries and detect their language
- AI classification of each inquiry (topic, related product, urgency)
- AI-suggested replies generated from the knowledge base, in the customer's language
- Agent review queue: edit, approve, and send AI drafts
- Escalation rules — AI hands off without drafting when: classification confidence is low, the topic is a complaint or refund, or the customer asks for a human
- Routing of escalated inquiries to agents

### AI — product classification

- Auto-suggest category and tags when a product is created
- Admin can accept or override suggestions

### Dashboard (internal)

- Product management: create, edit, and manage all products with translated content (EN / AR / SW / FR)
- Manual inventory management with low-stock flags
- Order management: view, confirm, update status, cancel
- Inquiry queue with AI-drafted replies
- Knowledge base management (admin): create/edit articles in all four languages; admin owns keeping it in sync with current prices and stock
- User management (admin only): system is deployed with a seeded admin account; the admin creates and manages agent accounts (no staff self-registration)

## Out of scope for v1 (Phase 2+)

- Online payment gateway
- WhatsApp Business API integration
- Instagram/Facebook messaging integration
- POS integration for automatic inventory sync
- Fully automatic (unreviewed) AI replies for high-confidence cases

## Open questions

- Customer accounts vs. guest checkout — leaning guest checkout with phone confirmation for v1, since there is no online payment; accounts affect order tracking and AI access to customer history
- Delivery logistics: who delivers, coverage area, fees
- Launch languages: all four at once, or start with two and add the rest as content is translated

## Success metrics

- Median first-response time to customer inquiries
- % of inquiries resolved from an AI draft approved without edits
- % of inquiries escalated to agents
- Online orders placed per week
- Product classification accuracy (admin override rate)

## Tech notes

- Database via Prisma (already in repo); record framework, database, and AI provider choices here as they are made
