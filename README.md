# webapp-boilerplate

Production-grade SaaS web-app boilerplate. Full-stack skeleton with auth, billing, dashboard, multi-tenant orgs — wired and working out of the box.

**Used by [AgentFlow](https://agentflow.website) `apply_boilerplate` for `kind=spa` (complex) / `kind=webapp` projects.** Drop your domain logic on top of a real app, not an empty Vite SPA.

## Stack

- Vite 7 + React 19 + TypeScript strict + Tailwind 4
- NestJS 11 + Prisma 6 + PostgreSQL 16
- TanStack Query + zustand + react-router-dom 7
- JWT (access + refresh) + Argon2 + magic link + Resend
- Stripe Checkout + customer portal + signature-verified webhooks
- Multi-tenant orgs with OWNER/ADMIN/MEMBER roles
- API keys + outbound HMAC-signed webhooks
- Admin panel + audit log
- Prometheus `/metrics` + structured pino logs

## Quick start

```bash
pnpm install
cp .env.example .env
docker-compose up -d
pnpm prisma:migrate
pnpm dev
```

Frontend at <http://localhost:5173>, backend at <http://localhost:3000>, Swagger at `/docs`.

## Read [`AGENTS.md`](./AGENTS.md)

Detailed map of what's where, what to edit, what NOT to touch. **Required reading** before changing anything.

## License

MIT
