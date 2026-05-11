import { Controller, Get, Header, Module, OnModuleInit } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Registry, collectDefaultMetrics } from 'prom-client';

@Controller('metrics')
class MetricsController implements OnModuleInit {
  private readonly registry = new Registry();

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}

@Module({ controllers: [MetricsController] })
export class MetricsModule {}
