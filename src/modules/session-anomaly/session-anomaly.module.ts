import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { SessionAnomalyController } from './session-anomaly.controller';
import { SessionAnomalyEvent } from './entities/session-anomaly-event.entity';
import { SessionAnomalyService } from './session-anomaly.service';

@Module({
  imports: [TypeOrmModule.forFeature([SessionAnomalyEvent, Session])],
  controllers: [SessionAnomalyController],
  providers: [SessionAnomalyService],
  exports: [SessionAnomalyService],
})
export class SessionAnomalyModule {}
