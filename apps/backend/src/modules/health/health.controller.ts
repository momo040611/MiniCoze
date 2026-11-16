import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { formatShanghaiDateTime } from '../../common/utils/date-time';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

interface ReadinessResponse {
  status: 'ok' | 'unavailable';
  service: string;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // liveness：进程存活即通过，不探测外部依赖（供容器重启策略使用）。
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'MiniCoze Backend',
      timestamp: formatShanghaiDateTime(new Date()),
    };
  }

  // readiness：探测数据库连通性，失败时返回 503（供负载均衡摘除实例）。
  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    const checks: ReadinessResponse['checks'] = {
      database: 'down',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      // 探测失败：保持 down，走统一的 503 返回。
    }

    if (checks.database === 'down') {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'MiniCoze Backend',
        timestamp: formatShanghaiDateTime(new Date()),
        checks,
      });
    }

    return {
      status: 'ok',
      service: 'MiniCoze Backend',
      timestamp: formatShanghaiDateTime(new Date()),
      checks,
    };
  }
}
