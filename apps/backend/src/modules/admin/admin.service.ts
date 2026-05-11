import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(q: string | undefined, limit: number) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : undefined,
      select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true, deletedAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listOrgs(q?: string) {
    return this.prisma.org.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : undefined,
      include: { subscription: { include: { tier: true } }, _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async overrideSubscription(
    adminId: string,
    orgId: string,
    tierSlug: string,
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE',
  ) {
    const tier = await this.prisma.pricingTier.findUnique({ where: { slug: tierSlug } });
    if (!tier) throw new NotFoundException('tier not found');
    const sub = await this.prisma.subscription.upsert({
      where: { orgId },
      create: { orgId, tierId: tier.id, status },
      update: { tierId: tier.id, status },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        orgId,
        action: 'admin.subscription.override',
        metadata: { tierSlug, status },
      },
    });
    return sub;
  }

  audit(limit: number) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, email: true } } },
    });
  }
}
