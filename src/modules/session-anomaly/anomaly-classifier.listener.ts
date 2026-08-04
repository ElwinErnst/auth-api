import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnomalyClassifierService } from './anomaly-classifier.service';
import {
  ANOMALY_PERSISTED_EVENT,
  AnomalyPersistedEvent,
} from './types/anomaly-persisted.event';

/**
 * Bridges the rule engine's in-process `anomaly.persisted` event to the LLM
 * classifier. Runs off the login path; `classifyPersisted` is self-contained
 * and never throws, so a classifier failure cannot affect authentication.
 */
@Injectable()
export class AnomalyClassifierListener {
  private readonly logger = new Logger(AnomalyClassifierListener.name);

  constructor(private readonly classifier: AnomalyClassifierService) {}

  @OnEvent(ANOMALY_PERSISTED_EVENT, { async: true, promisify: true })
  async handle(payload: AnomalyPersistedEvent): Promise<void> {
    try {
      await this.classifier.classifyPersisted(payload);
    } catch (err) {
      // classifyPersisted is defensive, but never let a listener rejection
      // surface as an unhandled promise rejection.
      this.logger.error(
        `Unexpected error handling ${ANOMALY_PERSISTED_EVENT} for ${payload.eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
