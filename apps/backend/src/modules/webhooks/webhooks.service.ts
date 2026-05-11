import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { randomBytes, createHmac } from 'node:crypto';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, orgId: string) {
    await this.requireMember(userId, orgId);
    return this.prisma.webhook.findMany({
      where: { orgId },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, orgId: string, dto: { url: string; events: string[] }) {
    await this.requireMember(userId, orgId);
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const wh = await this.prisma.webhook.create({
      data: { orgId, url: dto.url, events: dto.events, secret },
      select: { id: true, url: true, events: true, secret: true },
    });
    return wh; // secret only shown on create
  }

  async delete(userId: string, orgId: string, id: string) {
    await this.requireMember(userId, orgId);
    const wh = await this.prisma.webhook.findUnique({ where: { id } });
    if (!wh || wh.orgId !== orgId) throw new NotFoundException();
    await this.prisma.webhook.delete({ where: { id } });
    return { ok: true };
  }

  /** Dispatch an event to all subscribed webhooks for an org. */
  async dispatch(orgId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const targets = await this.prisma.webhook.findMany({
      where: { orgId, active: true, events: { has: eventType } },
    });
    await Promise.allSettled(
      targets.map(async (w) => {
        const body = JSON.stringify({ event: eventType, data: payload, ts: Date.now() });
        const sig = createHmac('sha256', w.secret).update(body).digest('hex');
        await fetch(w.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-signature': sig, 'x-event': eventType },
          body,
        }).catch(() => undefined);
      }),
    );
  }

  private async requireMember(userId: string, orgId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException();
    return m;
  }
}
