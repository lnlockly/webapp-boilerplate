import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live(): { ok: boolean; ts: number } {
    return { ok: true, ts: Date.now() };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{ ok: boolean; db: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      return { ok: false, db: false };
    }
  }

  @Public()
  @Get()
  root(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
