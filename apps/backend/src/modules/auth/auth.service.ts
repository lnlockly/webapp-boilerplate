import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import type { RegisterDto, LoginDto } from './dto/auth.dto';
import { createHash, randomBytes } from 'node:crypto';

type Meta = { ip?: string; ua?: string | string[] | undefined };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto, meta: Meta) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('email already in use');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash, role: 'USER' },
    });

    await this.sendVerifyEmail(user.id, user.email);
    await this.audit('user.register', user.id, null, meta);

    const tokens = await this.issueTokens(user, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: Meta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('invalid credentials');
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    if (user.deletedAt) throw new UnauthorizedException('account disabled');

    await this.audit('user.login', user.id, null, meta);
    const tokens = await this.issueTokens(user, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: Meta) {
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshHash: hash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh token invalid');
    }

    // Rotate: revoke old, issue new.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(session.user, meta);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { org: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return {
      ...this.publicUser(user),
      orgs: user.memberships.map((m) => ({
        id: m.org.id,
        slug: m.org.slug,
        name: m.org.name,
        role: m.role,
      })),
    };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // silent — don't leak
    const { token, hash } = this.makeToken();
    await this.prisma.emailToken.create({
      data: {
        userId: user.id,
        kind: 'RESET_PASSWORD',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    await this.email.send(user.email, 'password_reset', { token, name: user.name ?? user.email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = this.hashToken(token);
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.kind !== 'RESET_PASSWORD' || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('invalid or expired token');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.emailToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async verifyEmail(token: string): Promise<void> {
    const hash = this.hashToken(token);
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.kind !== 'VERIFY_EMAIL' || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('invalid or expired token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
      this.prisma.emailToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    ]);
  }

  async requestMagicLink(email: string): Promise<void> {
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email } });
    }
    const { token, hash } = this.makeToken();
    await this.prisma.emailToken.create({
      data: {
        userId: user.id,
        kind: 'MAGIC_LINK',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
      },
    });
    await this.email.send(user.email, 'magic_link', { token, name: user.name ?? user.email });
  }

  async consumeMagicLink(token: string, meta: Meta) {
    const hash = this.hashToken(token);
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.kind !== 'MAGIC_LINK' || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('invalid or expired magic link');
    }
    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    });
    await this.prisma.emailToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    const tokens = await this.issueTokens(user, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  private async sendVerifyEmail(userId: string, email: string): Promise<void> {
    const { token, hash } = this.makeToken();
    await this.prisma.emailToken.create({
      data: {
        userId,
        kind: 'VERIFY_EMAIL',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });
    await this.email.send(email, 'verify_email', { token });
  }

  private async issueTokens(user: { id: string; email: string; role: 'USER' | 'SUPERADMIN' }, meta: Meta) {
    const accessToken = await this.tokens.signAccess({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshHash = this.hashToken(refreshToken);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash,
        userAgent: Array.isArray(meta.ua) ? meta.ua[0] : meta.ua,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private makeToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashToken(token) };
  }

  private publicUser<T extends { id: string; email: string; name: string | null; avatarUrl: string | null; emailVerified: Date | null; role: 'USER' | 'SUPERADMIN' }>(u: T) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      emailVerified: u.emailVerified,
      role: u.role,
    };
  }

  private async audit(action: string, userId: string | null, orgId: string | null, meta: Meta) {
    await this.prisma.auditLog
      .create({
        data: {
          action,
          userId: userId ?? undefined,
          orgId: orgId ?? undefined,
          ip: meta.ip,
          userAgent: Array.isArray(meta.ua) ? meta.ua[0] : meta.ua,
        },
      })
      .catch(() => undefined);
  }
}
