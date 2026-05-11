import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { org: true } } },
    });
    if (!user) throw new NotFoundException();
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, patch: { name?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: patch.name, avatarUrl: patch.avatarUrl },
      select: { id: true, name: true, avatarUrl: true, email: true },
    });
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException('no password set');
    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new BadRequestException('current password is wrong');
    const passwordHash = await argon2.hash(next);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async softDelete(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: `deleted+${userId}@invalid` } }),
      this.prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }
}
