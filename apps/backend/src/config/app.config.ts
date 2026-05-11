/**
 * Backend feature flags & runtime config.
 * Mirror of apps/frontend/src/config/app.config.ts shape.
 * Coders edit THIS file to brand & toggle features per project.
 */
export const appConfig = {
  brand: {
    name: process.env.APP_NAME ?? 'AppX',
    supportEmail: 'support@example.com',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  },
  features: {
    multiOrg: true,
    billing: {
      enabled: Boolean(process.env.STRIPE_SECRET_KEY),
      provider: 'stripe' as 'stripe' | 'telegram_stars',
    },
    oauth: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID),
      github: Boolean(process.env.GITHUB_CLIENT_ID),
    },
    emailVerification: true,
    magicLink: true,
    apiKeys: true,
    webhooks: true,
    adminPanel: true,
  },
  email: {
    from: process.env.EMAIL_FROM ?? 'AppX <noreply@example.com>',
    enabled: Boolean(process.env.RESEND_API_KEY),
  },
  swagger: {
    enabled: process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === '1',
  },
};
