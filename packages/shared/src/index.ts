/**
 * Shared types between frontend & backend. Pure TS — no runtime deps.
 * Keep these in sync with Prisma models hand-written; do not import @prisma/client here.
 */

export type GlobalRole = 'USER' | 'SUPERADMIN';
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: string | null;
  role: GlobalRole;
}

export interface OrgRef {
  id: string;
  slug: string;
  name: string;
  role: OrgRole;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}
