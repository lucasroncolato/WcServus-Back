import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('db')
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', target: 'db', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', target: 'db' });
    }
  }

  @Public()
  @Get('redis')
  redis() {
    const configured = Boolean(this.configService.get<string>('REDIS_URL'));
    return {
      status: configured ? 'ok' : 'not_configured',
      target: 'redis',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('queue')
  queue() {
    const configured = Boolean(this.configService.get<string>('QUEUE_DRIVER'));
    return {
      status: configured ? 'ok' : 'not_configured',
      target: 'queue',
      timestamp: new Date().toISOString(),
    };
  }
}
