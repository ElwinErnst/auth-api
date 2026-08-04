import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { SessionAnomalyController } from './session-anomaly.controller';
import { SessionAnomalyEvent } from './entities/session-anomaly-event.entity';
import { SessionAnomalyClassification } from './entities/session-anomaly-classification.entity';
import { SessionAnomalyService } from './session-anomaly.service';
import { AnomalyClassifierService } from './anomaly-classifier.service';
import { AnomalyClassifierListener } from './anomaly-classifier.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SessionAnomalyEvent,
      SessionAnomalyClassification,
      Session,
    ]),
  ],
  controllers: [SessionAnomalyController],
  providers: [
    SessionAnomalyService,
    AnomalyClassifierService,
    AnomalyClassifierListener,
  ],
  exports: [SessionAnomalyService],
})
export class SessionAnomalyModule {}
