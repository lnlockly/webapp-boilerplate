# AGENTS.md

Read this first. This file is the entry point for AI agents working on this codebase.

## What this is

A production-grade **SaaS web-app boilerplate** — full-stack skeleton with everything every B2B / B2C web product needs on day one:

- Auth (email/password, magic link, JWT + refresh, sessions, email verification, password reset)
- Multi-tenant orgs (create, invite, role-based access)
- Billing (Stripe Checkout + customer portal + webhooks → subscription state in DB)
- API keys (per-user, scoped, hashed at rest)
- Outbound webhooks (org-scoped, HMAC-signed)
- Admin panel (`/admin` — user/org list, subscription override, audit log)
- Onboarding wizard, dark mode, dashboard layout, empty states

Plug your **domain logic** on top — the platform layer is done.

## What's inside, what's not

| Included (don't rewrite)                   | Plug-in (you build)                          |
|--------------------------------------------|----------------------------------------------|
| JWT mint/verify, refresh-token rotation    | Your domain entities (CRM contacts, etc.)    |
| Argon2 password hashing                    | Domain modules in `apps/backend/src/modules/`|
| Prisma schema for core models              | Pages in `apps/frontend/src/pages/`          |
| Stripe checkout/portal/webhook plumbing    | Brand & feature flags (`app.config.ts`)      |
| Role guards (org-level OWNER/ADMIN/MEMBER) | New Prisma models + migrations               |
| Audit log + outbound webhooks dispatcher   | Email templates beyond the 4 built-ins       |
| Health, /metrics (Prometheus), Swagger     | i18n strings, marketing pages                |

## Tech stack

- **Frontend** — Vite 7 + React 19 + TypeScript strict + Tailwind v4 (via `@tailwindcss/vite`) + react-router-dom 7 + TanStack Query 5 + zustand
- **Backend** — NestJS 11 + TypeScript strict + Prisma 6 + PostgreSQL 16
- **Auth** — JWT access (15m, in-memory) + refresh (30d, httpOnly signed cookie); Argon2 hashes
- **Cache** — Redis (sessions / rate-limit; BullMQ ready for background jobs)
- **Billing** — Stripe (test mode); Telegram Stars is a placeholder provider in `app.config.ts`
- **Email** — Resend; without `RESEND_API_KEY` it logs to console (dev-friendly)
- **Storage** — S3-compatible (placeholder; falls back to local `/uploads`)
- **Observability** — pino, prom-client `/metrics`, `/health/live` + `/health/ready`, Sentry DSN slot
- **Package manager** — pnpm workspaces (monorepo: `apps/*` + `packages/*`)

## Project layout

```
webapp-boilerplate/
├── apps/
│   ├── frontend/                    Vite + React SPA
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx              ← top-level routes
│   │   │   ├── config/app.config.ts ← BRAND + FEATURES (edit this)
│   │   │   ├── pages/
│   │   │   │   ├── auth/            Login / Register / Forgot / Reset / Verify / MagicLink
│   │   │   │   ├── dashboard/       Dashboard, Onboarding
│   │   │   │   ├── settings/        Profile, Team, Billing, ApiKeys, Webhooks
│   │   │   │   └── admin/           Admin panel
│   │   │   ├── components/ui/       Button, Input, Card primitives
│   │   │   ├── layouts/             AuthLayout, AppLayout
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           Typed fetch wrapper + refresh-on-401
│   │   │   │   ├── auth.tsx         RequireAuth route guard
│   │   │   │   ├── auth-store.ts    zustand
│   │   │   │   └── theme.ts         light/dark/auto
│   │   │   └── styles/index.css     @import "tailwindcss" + brand tokens
│   │   └── package.json
│   └── backend/                     NestJS API
│       ├── src/
│       │   ├── main.ts              bootstrap, helmet, cookie-parser, swagger
│       │   ├── app.module.ts
│       │   ├── config/app.config.ts ← BACKEND FEATURE FLAGS (edit this)
│       │   ├── common/
│       │   │   ├── prisma/          PrismaModule + PrismaService (global)
│       │   │   └── decorators/      @CurrentUser, @Public, @Roles
│       │   └── modules/
│       │       ├── auth/            register/login/refresh/logout/forgot/reset/verify/magic
│       │       ├── users/           profile, change-password, soft-delete (GDPR)
│       │       ├── orgs/            create / members / invite / role mgmt
│       │       ├── billing/         tiers, checkout, portal, Stripe webhook
│       │       ├── api-keys/        generate / revoke / verify
│       │       ├── webhooks/        outbound HMAC-signed dispatch
│       │       ├── admin/           SUPERADMIN-only endpoints
│       │       └── health/          /health, /metrics
│       ├── prisma/
│       │   └── schema.prisma        ← add your domain models below the core
│       └── scripts/
│           └── seed-tiers.ts        Stripe price → DB sync helper
├── packages/
│   └── shared/                      Pure-TS shared types (PublicUser, OrgRole, …)
├── docker-compose.yml               postgres + redis + minio for local dev
├── .env.example                     all env vars in one place
├── .github/workflows/deploy.yml     CI/CD scaffold (build → push → migrate)
└── AGENTS.md                        ← you are here
```

## Run it

```bash
pnpm install
cp .env.example .env                          # edit DATABASE_URL, JWT_SECRET, etc.
docker-compose up -d                          # postgres + redis + minio
pnpm prisma:migrate                           # apply migrations
pnpm --filter @app/backend exec ts-node scripts/seed-tiers.ts   # optional — seed pricing tiers
pnpm dev                                      # both apps in parallel
```

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:3000>, swagger at `/docs`
- Health: `GET /health/live`, `GET /health/ready`
- Metrics: `GET /metrics` (Prometheus text format)

## Where to make changes — common recipes

### Brand the app for a client

1. Replace `apps/frontend/public/logo.svg`.
2. Edit `apps/frontend/src/config/app.config.ts`:
   ```ts
   brand: { name: 'Acme CRM', logo: '/logo.svg', tagline: 'Sales pipelines in 60s' },
   theme: { primary: '#0EA5E9', mode: 'auto' },
   ```
3. Edit `apps/backend/src/config/app.config.ts` for `APP_NAME` / `supportEmail`.
4. Edit `apps/frontend/src/styles/index.css` `@theme` block to change Tailwind colour tokens.

That's it — there are no hard-coded brand strings anywhere else.

### Add a new domain entity (e.g. `Lead` for a CRM)

1. **DB model** — append to `apps/backend/prisma/schema.prisma`:
   ```prisma
   model Lead {
     id        String   @id @default(cuid())
     orgId     String
     name      String
     email     String?
     stage     LeadStage @default(NEW)
     ownerId   String?
     createdAt DateTime @default(now())
     org   Org   @relation(fields: [orgId], references: [id], onDelete: Cascade)
     owner User? @relation(fields: [ownerId], references: [id])
     @@index([orgId])
   }
   enum LeadStage { NEW QUALIFIED PROPOSAL WON LOST }
   ```
   Also add reverse relations on `Org` and `User`.
2. `pnpm prisma:migrate` (it'll prompt for a migration name).
3. **Backend module** — copy `apps/backend/src/modules/api-keys/` as a template:
   - `leads.module.ts` (Controllers + Providers).
   - `leads.controller.ts` — `GET /orgs/:orgId/leads`, `POST`, `PATCH /:id`, `DELETE /:id`. Use `@CurrentUser()` and validate org membership in the service.
   - `leads.service.ts` — re-use the `requireMember(userId, orgId)` pattern from `OrgsService` / `BillingService`.
   - Register the module in `app.module.ts`.
4. **API typings** — append types + wrappers in `apps/frontend/src/lib/api.ts`:
   ```ts
   export const leads = {
     list: (orgId: string) => api<Lead[]>(`/orgs/${orgId}/leads`),
     create: (orgId: string, body: { name: string; email?: string }) =>
       api<Lead>(`/orgs/${orgId}/leads`, { method: 'POST', body }),
   };
   ```
5. **Frontend page** — copy `pages/settings/TeamTab.tsx` into `pages/leads/LeadsPage.tsx`, swap `orgs.members(...)` for `leads.list(orgId)`. Add the route in `App.tsx` and a sidebar link in `layouts/AppLayout.tsx`.

That's the full loop. No other files need editing for new domain entities.

### Wire Stripe (test mode → live)

1. Create Products + Prices in Stripe dashboard, copy the `price_…` IDs.
2. Set env: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, `STRIPE_PRICE_PRO=price_…`, `STRIPE_PRICE_ENTERPRISE=price_…`.
3. `pnpm --filter @app/backend exec ts-node scripts/seed-tiers.ts`.
4. Set `features.billing.enabled = true` in **both** `app.config.ts` files (frontend hides Billing tab without it; backend returns 503 on `/billing/*`).
5. Point Stripe webhook at `https://your-host/webhooks/stripe` and subscribe to: `checkout.session.completed`, `customer.subscription.{updated,deleted}`, `invoice.{paid,payment_failed}`.

For local testing: `stripe listen --forward-to localhost:3000/webhooks/stripe`.

### Enable Google / GitHub OAuth

The placeholders are in place. Wire them in three steps:

1. Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (or GitHub equivalents) in env.
2. Flip `features.oauth.google` (or `.github`) to `true` in `apps/frontend/src/config/app.config.ts`.
3. Add `passport-google-oauth20` (or `passport-github2`) strategy under `apps/backend/src/modules/auth/strategies/`, then mount controller routes `GET /api/v1/auth/google` + `GET /api/v1/auth/google/callback`. Use `OAuthAccount` Prisma model to upsert. (15-30 min of work; left out to keep deps lean.)

### Add a new email template

Open `apps/backend/src/modules/auth/email.service.ts`. Add a new `Template` literal, push a subject into `subjects`, return an HTML string in `render()`. Without `RESEND_API_KEY` it logs to console — perfect for dev.

### Add a background job

BullMQ is already in deps. Add a queue, e.g. `weeklyDigest`:

```ts
// modules/digests/digests.module.ts
import { Queue, Worker } from 'bullmq';
const connection = { url: process.env.REDIS_URL };
export const digestQueue = new Queue('digest', { connection });

new Worker('digest', async (job) => { /* … */ }, { connection });
```

Wire the worker as a NestJS provider with `OnModuleInit` so it boots with the app.

### Switch from Postgres to SQLite for local dev

Don't — it's not worth the headache. The schema uses `String[]` (Postgres arrays) and `Json` columns. The provided `docker-compose.yml` gives you Postgres in one command.

## Patterns to follow

- **Auth in services**, not controllers: every org-scoped endpoint calls `requireMember(userId, orgId)` or `requireRole(...)` from the corresponding service. Don't trust route params.
- **DTOs are validated globally**: `class-validator` decorators on every `Body()` DTO; the global `ValidationPipe` with `whitelist: true` strips unknown fields.
- **Tokens are hashed at rest**: refresh tokens, password-reset, magic-link, API keys — all stored as SHA-256 hashes. Never log the plain value.
- **Frontend never touches `fetch` directly** — use the `api.ts` wrappers. Refresh-on-401 is built in.
- **Tailwind classes, not inline styles.** Brand colours live in `styles/index.css` `@theme {}` block.
- **No comments unless non-obvious.** Most code reads top-to-bottom.

## Security checklist before production

- [ ] Rotate `JWT_SECRET` and `COOKIE_SECRET` (≥ 64 random bytes each).
- [ ] Set `NODE_ENV=production` → cookies become `secure: true`.
- [ ] Set `CORS_ORIGINS` to exact frontend hostname (no `*`).
- [ ] Stripe webhook secret is set and route `/webhooks/stripe` is publicly reachable.
- [ ] Run `pnpm audit --prod` and patch criticals.
- [ ] Add rate limiting per IP for `/auth/*` (the global `@nestjs/throttler` baseline is 100 req/min — tighten for login).
- [ ] Hook up Sentry: set `SENTRY_DSN` and add the SDK init in `main.ts`.
- [ ] Verify email-verification flow before granting paid features.
- [ ] Configure outbound CSP headers (helmet is in default mode — tune for your CDN).

## Verifying after a refactor

```bash
pnpm install
pnpm --filter @app/backend prisma:generate
pnpm build                                # both apps must build cleanly
```

If `pnpm build` fails in the backend with `Cannot find module '@prisma/client'`, run `pnpm prisma:generate` first.

If the frontend throws `Tailwind v4 plugin not found`, you removed `@tailwindcss/vite` from `vite.config.ts` — restore it. (We do NOT use `tailwind.config.js` or `postcss.config.js` — v4 is zero-config through the Vite plugin.)

## When in doubt

- **Don't rewrite auth.** Email-verification tokens are sha256-hashed at rest, refresh rotates on every use, sessions get revoked when password changes. These are battle-tested patterns; if you touch them you'll create a security bug.
- **Don't bypass the org-role guards.** Org-scoped endpoints must call `requireRole(userId, orgId, [...])` in the service. Adding a `SUPERADMIN`-only endpoint? Use `@Roles('SUPERADMIN')` decorator (see `admin.controller.ts`).
- **Don't store secrets in env at runtime.** The `.env.example` is a checklist, not a production config. Use your platform's secret manager.
- **Don't add a domain model directly to `User` / `Org`.** Always create a new model with a foreign-key — keeps migrations clean.
