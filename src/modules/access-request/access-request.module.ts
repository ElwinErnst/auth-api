import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccessRequest } from './entities/access-request.entity';
import { AccessReviewModule } from '../access-review/access-review.module';
import { AccessRequestAgentService } from './access-request-agent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessRequest]),
    AccessReviewModule, // exports AccessReviewSnapshotService (reused for context)
  ],
  providers: [AccessRequestAgentService],
  exports: [AccessRequestAgentService],
})
export class AccessRequestModule {}
