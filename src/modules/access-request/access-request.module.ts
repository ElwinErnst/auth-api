import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccessRequest } from './entities/access-request.entity';
import { AccessReviewModule } from '../access-review/access-review.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { AccessRequestAgentService } from './access-request-agent.service';
import { AccessRequestService } from './access-request.service';
import { AccessRequestController } from './access-request.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessRequest]),
    AccessReviewModule, // exports AccessReviewSnapshotService (reused for context)
    MembershipsModule, // exports MembershipsService (applied on approval)
  ],
  controllers: [AccessRequestController],
  providers: [AccessRequestAgentService, AccessRequestService],
  exports: [AccessRequestAgentService, AccessRequestService],
})
export class AccessRequestModule {}
