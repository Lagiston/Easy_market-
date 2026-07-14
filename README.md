# ES-Market

E-commerce site + AI-assisted customer support for Easy Shopping Market. See `Project-Scope.md` for the product scope and `tech-stack.md` for stack decisions.

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (Homebrew: `brew services start postgresql@18`)

## Setup

```bash
createdb es_market

cd server
cp .env.example .env       # fill in DATABASE_URL (and later OPENAI/SENDGRID keys)
npm install
npx prisma migrate dev     # apply migrations + generate client
npx prisma db seed         # creates the admin from ADMIN_EMAIL/ADMIN_PASSWORD

cd ../client
npm install
```

## Run (two terminals)

```bash
cd server && npm run dev    # API on http://localhost:4000
cd client && npm run dev    # app on http://localhost:5173 (proxies /api)
```

Log in at `http://localhost:5173/dashboard/login` with the seeded admin credentials — you'll be required to set a new password, after which you can create agent accounts under **Users**.
