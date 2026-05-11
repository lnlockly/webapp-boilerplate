/**
 * BRAND CONFIG — coder edits this file (and apps/backend/src/config/app.config.ts).
 *
 * Toggle features on/off and adjust branding without touching component code.
 * Any feature listed as `false` causes the corresponding UI to hide and the
 * route to render an "unavailable" message.
 */
export const appConfig = {
  brand: {
    name: 'AppX',
    logo: '/logo.svg',
    tagline: 'The fastest way to build your SaaS',
    supportEmail: 'support@example.com',
  },
  features: {
    multi_org: true,
    billing: {
      enabled: false, // flip to true once Stripe keys are set in env
      provider: 'stripe' as 'stripe' | 'telegram_stars',
      showInSidebar: true,
    },
    oauth: { google: false, github: false },
    email_verification: true,
    magic_link: true,
    api_keys: true,
    webhooks: true,
    admin_panel: true,
  },
  theme: {
    primary: '#4F46E5',
    mode: 'auto' as 'light' | 'dark' | 'auto',
  },
  i18n: {
    default: 'en' as const,
    supported: ['en', 'ru'] as const,
  },
  onboarding: {
    steps: ['profile', 'organization', 'invite'] as const,
  },
};

export type AppConfig = typeof appConfig;
