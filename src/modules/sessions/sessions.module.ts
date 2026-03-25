import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordService } from '../auth/password.service';
import { Session } from './entities/session.entity';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [SessionsService, PasswordService],
  exports: [SessionsService],
})
export class SessionsModule {}
