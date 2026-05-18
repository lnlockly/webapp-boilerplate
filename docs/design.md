# Design: JWT SPA Dashboard + Stripe Billing

**Версия:** 1.0  
**Дата:** 2025-01-01  
**Стек:** NestJS (backend) · React + Vite (frontend) · PostgreSQL · Stripe  

---

## 1. File Tree

```
/workspace
├── backend/                        # NestJS monorepo workspace
│   ├── src/
│   │   ├── main.ts                 # Bootstrap, CORS, validation pipe
│   │   ├── app.module.ts           # Root module
│   │   │
│   │   ├── auth/                   # === Auth module ===
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts  # POST /auth/register, POST /auth/login
│   │   │   ├── auth.service.ts     # validateUser, issue JWT
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts # Passport JWT extract from Bearer token
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts  # @Roles('admin') check on role field
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── roles.decorator.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   │
│   │   ├── users/                  # === Users module ===
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts # GET /users, PATCH /users/:id, DELETE /users/:id
│   │   │   ├── users.service.ts
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   └── dto/
│   │   │       └── update-user.dto.ts
│   │   │
│   │   ├── billing/                # === Stripe Billing module ===
│   │   │   ├── billing.module.ts
│   │   │   ├── billing.controller.ts
│   │   │   │   # POST /billing/create-portal-session
│   │   │   │   # POST /billing/create-subscription   (admin / free → paid)
│   │   │   │   # GET  /billing/subscription         (my plan status)
│   │   │   ├── billing.service.ts  # Stripe SDK calls
│   │   │   └── dto/
│   │   │       └── create-subscription.dto.ts
│   │   │
│   │   ├── common/                 # Shared
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── interceptors/
│   │   │       └── transform.interceptor.ts
│   │   │
│   │   └── config/                 # Configuration
│   │       ├── config.module.ts
│   │       └── configuration.ts    # read from .env via @nestjs/config
│   │
│   ├── prisma/
│   │   └── schema.prisma           # User model, enums
│   │
│   ├── .env.example
│   ├── .env                        # BOT_TOKEN, DATABASE_URL, JWT_SECRET,
│   │                               #   JWT_EXPIRES_IN, STRIPE_SECRET_KEY,
│   │                               #   STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET,
│   │                               #   FRONTEND_URL
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   └── Dockerfile
│
├── frontend/                       # Vite + React SPA
│   ├── src/
│   │   ├── main.tsx                # ReactDOM.createRoot
│   │   ├── App.tsx                 # Router, AuthProvider, ProtectedRoute
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx   # Authenticated user home
│   │   │   ├── BillingPage.tsx     # Subscription management
│   │   │   └── AdminUsersPage.tsx  # Admin-only: list / edit / delete
│   │   │
│   │   ├── components/
│   │   │   ├── AuthProvider.tsx    # Context: token, user, login/logout
│   │   │   ├── ProtectedRoute.tsx # Redirect to /login if no token
│   │   │   ├── AdminRoute.tsx      # Redirect to /dashboard if not admin
│   │   │   ├── Navbar.tsx
│   │   │   ├── UserTable.tsx       # Admin: sortable table
│   │   │   └── PlanBadge.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── apiClient.ts        # axios instance, interceptor (inject JWT)
│   │   │   ├── auth.ts             # register, login, me
│   │   │   ├── users.ts            # getUsers, updateUser, deleteUser
│   │   │   └── billing.ts          # createSubscription, createPortalSession, getPlan
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useSubscription.ts
│   │   │
│   │   └── styles/
│   │       └── globals.css         # AgentFlow design tokens (dark theme)
│   │
│   ├── public/
│   │   └── favicon.svg
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── package.json
│   └── tailwind.config.js          # Optional; uses @tailwindcss/vite
│
├── docs/
│   └── design.md                   # Этот документ — source of truth
│
└── docker-compose.yml              # PostgreSQL + backend + frontend (optional)
```

---

## 2. API Contracts (Internal Backend API)

### Auth

```
POST /auth/register
Body:    { email: string, password: string, firstName?: string, lastName?: string }
Returns: { access_token: string, user: UserDto }
Status:  201 Created | 409 Conflict (email exists) | 400 Bad Request

POST /auth/login
Body:    { email: string, password: string }
Returns: { access_token: string, user: UserDto }
Status:  200 OK | 401 Unauthorized

GET  /auth/me
Guard:   JWT required
Returns: { user: UserDto }
```

### Users

```
GET    /users
Guard:  JWT + Roles('admin')
Query:  page?: number (default 1), limit?: number (default 20)
Returns: { data: UserDto[], total: number, page: number, limit: number }

PATCH  /users/:id
Guard:  JWT + Roles('admin')
Body:   { role?: 'user' | 'admin', isActive?: boolean }
Returns: { user: UserDto }

DELETE /users/:id
Guard:  JWT + Roles('admin')
Returns: 204 No Content
         404 Not Found | 403 Forbidden (self-delete protection)
```

### Billing

```
POST /billing/create-portal-session
Guard: JWT
Body:  { returnUrl: string }
Returns: { url: string }   ← Stripe Customer Portal URL

POST /billing/create-subscription
Guard: JWT
Body:  { priceId: string }   ← from STRIPE_PRICE_ID env
Returns: { url: string }     ← Stripe Checkout Session URL

GET  /billing/subscription
Guard: JWT
Returns: { plan: 'free'|'starter'|'pro', status: string, endsAt: string|null }
```

---

## 3. Data Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum Plan {
  FREE
  STARTER
  PRO
}

model User {
  id             String    @id @default(uuid())
  email          String    @unique
  passwordHash   String
  firstName      String?
  lastName       String?
  role           Role      @default(USER)
  plan           Plan      @default(FREE)
  stripeCustomerId String? @unique

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@map("users")
}
```

### Migrations

```bash
# Внутри backend/ — однократно:
cd /workspace/backend
npx prisma migrate dev --name init
```

---

## 4. Measurable Acceptance Criteria (≥5)

| # | Критерий | Как проверяем |
|---|----------|---------------|
| 1 | **Register → JWT issued.** POST /auth/register с валидным телом возвращает HTTP 201 и JSON с `access_token`. Token валиден для GET /auth/me. | `curl -X POST …/auth/register -d '{"email":"a@b.com","password":"Test1234!"}'` → 201 + token |
| 2 | **Login → JWT issued.** POST /auth/login с правильным паролем возвращает 200 + token; неверный пароль → 401. | `curl …/auth/login` → 200/401 |
| 3 | **Admin-only /users.** Запрос GET /users без JWT → 401; с JWT но без ADMIN role → 403. С ролью ADMIN → 200 + pagination. | `curl -H "Authorization: Bearer <token>" …/users` |
| 4 | **Admin edit user.** PATCH /users/:id с телом `{ "role": "admin" }` изменяет роль; DELETE /users/:id возвращает 204. | `curl -X PATCH …/users/… -d '{"role":"admin"}'` |
| 5 | **Stripe Checkout redirect.** POST /billing/create-subscription возвращает URL Stripe Checkout. При отсутствии `priceId` → 400. | `curl …/billing/create-subscription` |
| 6 | **Stripe Portal redirect.** POST /billing/create-portal-session возвращает URL Stripe Customer Portal. | `curl …/billing/create-portal-session` |
| 7 | **SPA Routing.** `npm run build` в frontend/ проходит без ошибок. http-server из `/workspace/frontend/dist` отдаёт HTTP 200 на `/` и `/assets/*.js`. | `ls dist/` + `curl -sI localhost:8080/` |
| 8 | **Protected routes.** При отсутствии токена SPA редиректит на `/login`; после логина → на `/dashboard`. | Playwright smoke test |
| 9 | **Admin route guard.** Не-админ, открывающий `/admin/users`, получает редирект на `/dashboard`. | Playwright smoke test |

---

## 5. Risk Register with Fallbacks

| Risk | Probability | Impact | Mitigation / Fallback |
|------|-------------|--------|-----------------------|
| Stripe keys not configured | Low | **High** → billing 500 | Если `STRIPE_SECRET_KEY` пуст → billing endpoints return `{ disabled: true, reason: "Stripe not configured" }`; UI скрывает кнопки оплаты |
| PostgreSQL not reachable | Low | **High** → full outage | `docker-compose up -d postgres`; prisma healthcheck в `main.ts` |
| JWT_SECRET not set | Medium | **High** → all auth broken | Валидация env при старте: если пусто — приложение падает с понятным сообщением ("JWT_SECRET required") |
| CORS mismatch frontend/backend | Medium | **Medium** | `CORS_ORIGIN=http://localhost:5173` в `.env`; NestJS `app.enableCors({ origin: config.frontendUrl })` |
| Frontend build fails on CI | Low | **Medium** | `cd /workspace/frontend && npm install && npm run build` — node ≥18 required; fallback: serve prev dist |
| Stripe webhook not reachable (dev) | High | **Low** (dev) / **High** (prod) | В dev — Stripe CLI tunnel; в prod — `/billing/webhook` endpoint; graceful degradation: subscription status = "unknown" |
| Prisma migration conflict | Low | **High** | `npx prisma migrate resolve --applied <migration>`; продакшен — только `prisma migrate deploy` |
| Cookie vs Bearer confusion | Medium | **Medium** | AuthProvider хранит JWT в `localStorage`; API-client добавляет `Authorization: Bearer <token>` header |

---

## 6. Eliza-native Usage Section

### Как Eliza (AI-компаньон) работает с этим проектом

Eliza получает текстовый контекст задачи; она НЕ выполняет код напрямую. Для каждого шага:

**Кодинг:**
- Прочитать `/workspace/docs/design.md` → следовать file tree и API contracts.
- Сначала scaffold backend: `npm create vite@latest . -- --template react-ts` в `/workspace/backend` (NestJS-проект аналогично), затем `npm install`.
- Следовать API contracts: endpoint paths, HTTP methods, request/response shapes.

**Тестирование:**
- Backend unit tests: `jest` с `@nestjs/testing`. Ключевые сценарии: auth flow, admin guard, billing stub.
- Playwright e2e smoke: логин → dashboard → admin page → logout.

**Deploy:**
- Backend: `start_service` с `cd /workspace/backend && npm run start:prod` (нужен build).
- Frontend: build → `http-server /workspace/frontend/dist -p 8080`.
- Все env-переменные — через `.env` (заполняется через `set_project_secret` для секретов).

### Frontend API Client (useAuth hook)

```tsx
// frontend/src/hooks/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from '../components/AuthProvider';

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
};
// Используется в ProtectedRoute, Navbar, AdminRoute для принятия решений на клиенте
```

---

## 7. Environment Variables Reference

```bash
# === Backend (.env) ===
DATABASE_URL="postgresql://user:pass@localhost:5432/dashboard_db"
JWT_SECRET="change-me-to-256bit-secret"
JWT_EXPIRES_IN="7d"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PRICE_ID="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
FRONTEND_URL="http://localhost:5173"

# === Frontend (.env) ===
VITE_API_BASE_URL="http://localhost:3000"
```

---

## 8. Development Quick-Start

```bash
# 1. Backend
cd /workspace/backend
cp .env.example .env           # заполнить DATABASE_URL, JWT_SECRET, STRIPE_*
npm install
npx prisma migrate dev --name init
npm run start:dev

# 2. Frontend (новый терминал)
cd /workspace/frontend
npm install
npm run dev                    # Vite dev server на :5173
```

---

**Документ актуален. Обновлять только через commit в /workspace/docs/design.md.**
