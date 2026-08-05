import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembership } from '../memberships/entities/tenant-membership.entity';
import { Session } from '../sessions/entities/session.entity';
import { UserPasskey } from '../passkeys/entities/user-passkey.entity';
import { ServiceAccount } from '../integrations/entities/service-account.entity';
import { ClientApp } from '../integrations/entities/client-app.entity';
import { SessionAnomalyEvent } from '../session-anomaly/entities/session-anomaly-event.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AccessReviewController } from './access-review.controller';
import { AccessReviewCron } from './access-review.cron';
import { AccessReviewService } from './access-review.service';
import { AccessReviewSnapshotService } from './access-review-snapshot.service';
import { TenantAccessReview } from './entities/tenant-access-review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantAccessReview,
      TenantMembership,
      Session,
      UserPasskey,
      ServiceAccount,
      ClientApp,
      SessionAnomalyEvent,
      Tenant,
    ]),
  ],
  controllers: [AccessReviewController],
  providers: [AccessReviewService, AccessReviewSnapshotService, AccessReviewCron],
  exports: [AccessReviewService],
})
export class AccessReviewModule {}
