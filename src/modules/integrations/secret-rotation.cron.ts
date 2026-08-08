import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class SecretRotationCron {
  private readonly logger = new Logger(SecretRotationCron.name);

  constructor(private readonly integrations: IntegrationsService) {}

  // Runs every 10 minutes. Rotations that are due within that window get
  // picked up on the next tick. The rotation itself is idempotent — if a
  // secret was already rotated between the query and the update, the
  // nextRotationAt has advanced past `now` and it's just skipped.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    try {
      const { rotated } = await this.integrations.autoRotateDue();
      if (rotated > 0) {
        this.logger.log(`tick rotated=${rotated}`);
      }
    } catch (err) {
      this.logger.error(
        `tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
