import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { SessionAnomalyService } from './session-anomaly.service';

@Controller('sessions/anomalies')
export class SessionAnomalyController {
  constructor(private readonly service: SessionAnomalyService) {}

  @UseGuards(AccessJwtGuard)
  @Get()
  list(
    @CurrentAuth() auth: AccessTokenPayload,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(Math.max(Number(limit), 1), 200) : 50;
    return this.service.listForUser(auth.sub, parsed);
  }
}
