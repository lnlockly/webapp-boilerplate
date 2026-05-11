/**
 * Centralised API client. All HTTP calls go through here.
 *
 * - access token is stored in zustand store (in-memory) — refresh cookie is httpOnly.
 * - on 401 we transparently refresh once and retry.
 */
import { useAuthStore } from './auth-store';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(typeof payload === 'object' && payload && 'message' in payload ? String((payload as { message: string }).message) : `HTTP ${status}`);
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  _retry?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const token = useAuthStore.getState().accessToken;
  if (!opts.skipAuth && token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts._retry && !opts.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) return api(path, { ...opts, _retry: true });
  }

  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    useAuthStore.getState().setToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ---------- Typed wrappers ----------
export const auth = {
  register: (body: { email: string; password: string; name?: string }) =>
    api<{ user: User; accessToken: string }>('/auth/register', { method: 'POST', body, skipAuth: true }),
  login: (body: { email: string; password: string }) =>
    api<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body, skipAuth: true }),
  me: () => api<UserWithOrgs>('/auth/me'),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  forgot: (email: string) => api<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email }, skipAuth: true }),
  reset: (token: string, newPassword: string) => api<{ ok: true }>('/auth/reset-password', { method: 'POST', body: { token, newPassword }, skipAuth: true }),
  verifyEmail: (token: string) => api<{ ok: true }>('/auth/verify-email', { method: 'POST', body: { token }, skipAuth: true }),
  magicRequest: (email: string) => api<{ ok: true }>('/auth/magic-link/request', { method: 'POST', body: { email }, skipAuth: true }),
  magicConsume: (token: string) => api<{ user: User; accessToken: string }>('/auth/magic-link/consume', { method: 'POST', body: { token }, skipAuth: true }),
  sessions: () => api<Session[]>('/auth/sessions'),
};

export const users = {
  updateProfile: (patch: { name?: string; avatarUrl?: string }) => api<User>('/users/me', { method: 'PATCH', body: patch }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: true }>('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } }),
  deleteMe: () => api<{ ok: true }>('/users/me', { method: 'DELETE' }),
};

export const orgs = {
  list: () => api<OrgWithRole[]>('/orgs'),
  create: (body: { name: string; slug?: string }) => api<Org>('/orgs', { method: 'POST', body }),
  members: (orgId: string) => api<Member[]>(`/orgs/${orgId}/members`),
  invite: (orgId: string, body: { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }) =>
    api<{ id: string; ok: true }>(`/orgs/${orgId}/invitations`, { method: 'POST', body }),
  removeMember: (orgId: string, userId: string) => api<{ ok: true }>(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' }),
};

export const billing = {
  tiers: () => api<Tier[]>('/billing/tiers'),
  subscription: (orgId: string) => api<Subscription | null>(`/billing/orgs/${orgId}/subscription`),
  invoices: (orgId: string) => api<Invoice[]>(`/billing/orgs/${orgId}/invoices`),
  checkout: (orgId: string, tierSlug: string) =>
    api<{ url: string }>(`/billing/orgs/${orgId}/checkout`, { method: 'POST', body: { tierSlug } }),
  portal: (orgId: string) => api<{ url: string }>(`/billing/orgs/${orgId}/portal`, { method: 'POST' }),
};

export const apiKeys = {
  list: () => api<ApiKey[]>('/api-keys'),
  create: (body: { name: string; orgId?: string; scopes: ('read' | 'write')[] }) =>
    api<ApiKey & { key: string }>('/api-keys', { method: 'POST', body }),
  revoke: (id: string) => api<{ ok: true }>(`/api-keys/${id}`, { method: 'DELETE' }),
};

export const webhooks = {
  list: (orgId: string) => api<Webhook[]>(`/orgs/${orgId}/webhooks`),
  create: (orgId: string, body: { url: string; events: string[] }) =>
    api<Webhook & { secret: string }>(`/orgs/${orgId}/webhooks`, { method: 'POST', body }),
  delete: (orgId: string, id: string) => api<{ ok: true }>(`/orgs/${orgId}/webhooks/${id}`, { method: 'DELETE' }),
};

export const admin = {
  users: (q?: string) => api<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  orgs: () => api<AdminOrg[]>('/admin/orgs'),
  audit: () => api<AuditEntry[]>('/admin/audit-log'),
};

// ---------- Types ----------
export interface User { id: string; email: string; name: string | null; avatarUrl: string | null; emailVerified: string | null; role: 'USER' | 'SUPERADMIN' }
export interface UserWithOrgs extends User { orgs: { id: string; slug: string; name: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }[] }
export interface Org { id: string; slug: string; name: string; logoUrl: string | null }
export interface OrgWithRole extends Org { role: 'OWNER' | 'ADMIN' | 'MEMBER' }
export interface Member { id: string; userId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; user: { id: string; email: string; name: string | null; avatarUrl: string | null } }
export interface Tier { id: string; slug: string; name: string; monthlyCents: number; features: Record<string, number | string>; stripePriceId: string | null }
export interface Subscription { id: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; tier: Tier }
export interface Invoice { id: string; amountCents: number; currency: string; status: string; hostedUrl: string | null; pdfUrl: string | null; createdAt: string }
export interface ApiKey { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; expiresAt: string | null; createdAt: string; orgId: string | null }
export interface Webhook { id: string; url: string; events: string[]; active: boolean; createdAt: string }
export interface Session { id: string; userAgent: string | null; ip: string | null; createdAt: string; expiresAt: string }
export interface AdminUser { id: string; email: string; name: string | null; role: string; createdAt: string; deletedAt: string | null }
export interface AdminOrg extends Org { subscription: Subscription | null; _count: { memberships: number } }
export interface AuditEntry { id: string; action: string; createdAt: string; user: { id: string; email: string } | null; metadata: Record<string, unknown> }
