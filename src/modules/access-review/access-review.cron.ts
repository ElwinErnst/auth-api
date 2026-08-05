import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Repository } from 'typeorm';
import type { AccessReviewConfig } from '../../config/access-review.config';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AccessReviewService } from './access-review.service';

@Injectable()
export class AccessReviewCron {
  private readonly logger = new Logger(AccessReviewCron.name);
  private readonly config: AccessReviewConfig;

  constructor(
    configService: ConfigService,
    private readonly service: AccessReviewService,
    private readonly scheduler: SchedulerRegistry,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {
    this.config = configService.get<AccessReviewConfig>('accessReview')!;
    if (this.config.enabled) {
      this.register();
    }
  }

  private register(): void {
    // Registered dynamically so the cron expression is env-driven; a decorator
    // baked in at compile time would freeze the schedule at build time.
    const job = new CronJob(this.config.cronExpression, () => {
      void this.tick();
    });
    this.scheduler.addCronJob('access-review-daily', job);
    job.start();
    this.logger.log(
      `access review cron registered with expression "${this.config.cronExpression}"`,
    );
  }

  private async tick(): Promise<void> {
    const activeTenants = await this.tenants.find({ where: { isActive: true } });
    this.logger.log(`access review tick: ${activeTenants.length} active tenants`);
    for (const tenant of activeTenants) {
      try {
        await this.service.run({ tenantId: tenant.id, trigger: 'scheduled' });
      } catch (err) {
        this.logger.error(
          `access review run failed for tenant=${tenant.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
