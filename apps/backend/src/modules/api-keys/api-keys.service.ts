import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        orgId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: { name: string; orgId?: string; scopes: ('read' | 'write')[] }) {
    if (dto.orgId) {
      const m = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId: dto.orgId } },
      });
      if (!m) throw new ForbiddenException();
    }
    const raw = `sk_${randomBytes(28).toString('base64url')}`;
    const prefix = raw.slice(0, 11);
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        orgId: dto.orgId,
        name: dto.name,
        prefix,
        keyHash,
        scopes: dto.scopes,
      },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
    });
    return { ...created, key: raw };
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== userId) throw new NotFoundException();
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async verify(plain: string) {
    const hash = createHash('sha256').update(plain).digest('hex');
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hash } });
    if (!key || key.revokedAt) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return key;
  }
}
