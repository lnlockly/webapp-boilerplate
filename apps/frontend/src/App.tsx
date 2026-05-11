import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { MagicLinkPage } from './pages/auth/MagicLinkPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ProfileTab } from './pages/settings/ProfileTab';
import { TeamTab } from './pages/settings/TeamTab';
import { BillingTab } from './pages/settings/BillingTab';
import { ApiKeysTab } from './pages/settings/ApiKeysTab';
import { WebhooksTab } from './pages/settings/WebhooksTab';
import { OnboardingPage } from './pages/dashboard/OnboardingPage';
import { AdminPage } from './pages/admin/AdminPage';
import { RequireAuth } from './lib/auth';
import { useThemeMode } from './lib/theme';

export function App() {
  useThemeMode();

  return (
    <Routes>
      {/* Public auth flow */}
      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/magic-link" element={<MagicLinkPage />} />
      </Route>

      {/* Protected app */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/settings" element={<SettingsPage />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route path="team" element={<TeamTab />} />
          <Route path="billing" element={<BillingTab />} />
          <Route path="api-keys" element={<ApiKeysTab />} />
          <Route path="webhooks" element={<WebhooksTab />} />
        </Route>
        <Route path="/admin/*" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
