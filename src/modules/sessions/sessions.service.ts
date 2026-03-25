import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { PasswordService } from '../auth/password.service';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(params: {
    userId: string;
    tenantId: string;
    refreshToken: string;
    expiresAt: Date;
    familyId?: string;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<Session> {
    const session = this.sessionsRepository.create({
      userId: params.userId,
      tenantId: params.tenantId,
      familyId: params.familyId ?? randomUUID(),
      refreshTokenHash: await this.passwordService.hash(params.refreshToken),
      expiresAt: params.expiresAt,
      userAgent: params.userAgent ?? null,
      ip: params.ip ?? null,
      revokedAt: null,
      replacedBySessionId: null,
      revokedReason: null,
    });

    return this.sessionsRepository.save(session);
  }

  async findActiveById(id: string): Promise<Session | null> {
    return this.sessionsRepository.findOne({
      where: {
        id,
        revokedAt: IsNull(),
      },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessionsRepository.findOne({ where: { id } });
  }

  async assertRefreshTokenMatch(
    session: Session,
    refreshToken: string,
  ): Promise<void> {
    const ok = await this.passwordService.verify(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!ok) {
      throw new UnauthorizedException('Refresh token mismatch');
    }
  }

  isExpired(session: Session): boolean {
    return session.expiresAt.getTime() <= Date.now();
  }

  async rotate(params: {
    currentSession: Session;
    newRefreshToken: string;
    newExpiresAt: Date;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<Session> {
    const next = await this.create({
      userId: params.currentSession.userId,
      tenantId: params.currentSession.tenantId,
      refreshToken: params.newRefreshToken,
      expiresAt: params.newExpiresAt,
      familyId: params.currentSession.familyId,
      userAgent: params.userAgent ?? params.currentSession.userAgent,
      ip: params.ip ?? params.currentSession.ip,
    });

    params.currentSession.revokedAt = new Date();
    params.currentSession.replacedBySessionId = next.id;
    params.currentSession.revokedReason = 'rotated';

    await this.sessionsRepository.save(params.currentSession);

    return next;
  }

  async revokeById(id: string, reason = 'logout'): Promise<void> {
    const session = await this.findById(id);
    if (!session || session.revokedAt) {
      return;
    }

    session.revokedAt = new Date();
    session.revokedReason = reason;
    await this.sessionsRepository.save(session);
  }

  async revokeAllForUser(userId: string, reason = 'logout_all'): Promise<void> {
    const sessions = await this.sessionsRepository.find({
      where: {
        userId,
        revokedAt: IsNull(),
      },
    });

    if (!sessions.length) {
      return;
    }

    const now = new Date();
    for (const session of sessions) {
      session.revokedAt = now;
      session.revokedReason = reason;
    }

    await this.sessionsRepository.save(sessions);
  }
}
