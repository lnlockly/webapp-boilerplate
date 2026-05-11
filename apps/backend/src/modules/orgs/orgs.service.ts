import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { createHash, randomBytes } from 'node:crypto';
import type { OrgRole } from '@prisma/client';

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { user: { id: userId } },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  }

  async create(userId: string, dto: { name: string; slug?: string }) {
    const slug = (dto.slug ?? this.slugify(dto.name)) || `org-${Date.now()}`;
    return this.prisma.org.create({
      data: {
        name: dto.name,
        slug,
        memberships: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  async getOrThrow(userId: string, orgId: string) {
    await this.requireMember(userId, orgId);
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException();
    return org;
  }

  async update(userId: string, orgId: string, patch: { name?: string; logoUrl?: string }) {
    await this.requireRole(userId, orgId, ['OWNER', 'ADMIN']);
    return this.prisma.org.update({ where: { id: orgId }, data: patch });
  }

  async listMembers(userId: string, orgId: string) {
    await this.requireMember(userId, orgId);
    return this.prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(userId: string, orgId: string, email: string, role: OrgRole) {
    await this.requireRole(userId, orgId, ['OWNER', 'ADMIN']);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitation.create({
      data: {
        orgId,
        email,
        role,
        tokenHash,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    await this.email.send(email, 'org_invite', { token, orgName: org?.name ?? '' });
    return { id: invitation.id, ok: true };
  }

  async updateMember(actorId: string, orgId: string, targetUserId: string, role: OrgRole) {
    await this.requireRole(actorId, orgId, ['OWNER']);
    return this.prisma.membership.update({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      data: { role },
    });
  }

  async removeMember(actorId: string, orgId: string, targetUserId: string) {
    await this.requireRole(actorId, orgId, ['OWNER', 'ADMIN']);
    if (actorId === targetUserId) {
      throw new ForbiddenException("you can't remove yourself; transfer ownership first");
    }
    await this.prisma.membership.delete({ where: { userId_orgId: { userId: targetUserId, orgId } } });
    return { ok: true };
  }

  private async requireMember(userId: string, orgId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('not a member');
    return m;
  }

  private async requireRole(userId: string, orgId: string, roles: OrgRole[]) {
    const m = await this.requireMember(userId, orgId);
    if (!roles.includes(m.role)) throw new ForbiddenException(`role ${roles.join('/')} required`);
    return m;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }
}
