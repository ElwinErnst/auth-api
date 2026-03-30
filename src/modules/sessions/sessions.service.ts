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
  ) { }

  async createEmpty(params: {
    userId: string;
    tenantId: string;
    expiresAt: Date;
    familyId?: string;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<Session> {
    const session = this.sessionsRepository.create({
      userId: params.userId,
      tenantId: params.tenantId,
      familyId: params.familyId ?? randomUUID(),
      refreshTokenHash: '',
      expiresAt: params.expiresAt,
      userAgent: params.userAgent ?? null,
      ip: params.ip ?? null,
      revokedAt: null,
      replacedBySessionId: null,
      revokedReason: null,
    });

    return this.sessionsRepository.save(session);
  }

  async updateRefreshToken(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const session = await this.findById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    session.refreshTokenHash = await this.passwordService.hash(refreshToken);
    await this.sessionsRepository.save(session);
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

  async revokeFamily(
    familyId: string,
    reason = 'refresh_token_reuse_detected',
  ): Promise<void> {
    const sessions = await this.sessionsRepository.find({
      where: {
        familyId,
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

  async revokeWithReplacement(
    sessionId: string,
    replacedBySessionId: string,
    reason = 'rotated',
  ): Promise<void> {
    const session = await this.findById(sessionId);

    if (!session || session.revokedAt) {
      return;
    }

    session.revokedAt = new Date();
    session.replacedBySessionId = replacedBySessionId;
    session.revokedReason = reason;

    await this.sessionsRepository.save(session);
  }
}