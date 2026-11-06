import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { Public } from '../../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'MiniCoze Backend',
      timestamp: formatShanghaiDateTime(new Date()),
    };
  }
}
