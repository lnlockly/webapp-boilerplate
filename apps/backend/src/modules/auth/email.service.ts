import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { appConfig } from '../../config/app.config';

type Template = 'verify_email' | 'password_reset' | 'magic_link' | 'org_invite';

const subjects: Record<Template, string> = {
  verify_email: 'Verify your email',
  password_reset: 'Reset your password',
  magic_link: 'Your magic sign-in link',
  org_invite: 'You have been invited',
};

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);
  private readonly resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  async send(to: string, template: Template, vars: Record<string, string>): Promise<void> {
    const subject = subjects[template];
    const html = this.render(template, vars);

    if (!this.resend) {
      // Dev fallback — never throws.
      this.log.warn(`[email:${template}] → ${to} | ${subject} | vars=${JSON.stringify(vars)}`);
      return;
    }

    try {
      await this.resend.emails.send({ from: appConfig.email.from, to, subject, html });
    } catch (err) {
      this.log.error(`resend send failed: ${(err as Error).message}`);
    }
  }

  private render(template: Template, vars: Record<string, string>): string {
    // Lightweight inline templates — replace with MJML / react-email when needed.
    const link = (path: string) =>
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}${path}?token=${encodeURIComponent(vars.token ?? '')}`;

    switch (template) {
      case 'verify_email':
        return `<p>Hello,</p><p>Confirm your email: <a href="${link('/auth/verify-email')}">click here</a>.</p>`;
      case 'password_reset':
        return `<p>Hi ${vars.name ?? ''},</p><p>Reset your password: <a href="${link('/auth/reset-password')}">click here</a>. Expires in 30 minutes.</p>`;
      case 'magic_link':
        return `<p>Click to sign in: <a href="${link('/auth/magic-link')}">magic link</a> (valid 15 min).</p>`;
      case 'org_invite':
        return `<p>You've been invited to <b>${vars.orgName}</b>. <a href="${link('/auth/invite')}">Accept</a>.</p>`;
    }
  }
}
