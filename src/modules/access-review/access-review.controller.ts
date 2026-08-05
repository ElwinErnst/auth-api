import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessReviewService } from './access-review.service';

@Controller('tenants/:tenantId/access-review')
@UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
@Roles('OWNER', 'ADMIN')
export class AccessReviewController {
  constructor(private readonly service: AccessReviewService) {}

  @Post('run')
  @HttpCode(200)
  async run(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    if (!this.service.isEnabled) {
      throw new BadRequestException(
        'Access review is disabled or missing an API key on this deployment.',
      );
    }
    return this.service.run({ tenantId, trigger: 'manual' });
  }

  @Get('latest')
  async latest(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    const row = await this.service.latestForTenant(tenantId);
    if (!row) {
      throw new NotFoundException('No access review has run for this tenant');
    }
    return row;
  }

  @Get('history')
  async history(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(Math.max(Number(limit), 1), 100) : 20;
    return this.service.listForTenant(tenantId, parsed);
  }
}
