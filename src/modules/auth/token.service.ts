import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { durationToMilliseconds } from '../../common/utils/duration.util';
import { AccessTokenPayload } from './types/access-token-payload.type';
import { RefreshTokenPayload } from './types/refresh-token-payload.type';
import { TokenPair } from './types/token-pair.type';

type JwtConfig = {
  issuer: string;
  audience: string;
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
};

@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
  }

  async signAccessToken(params: {
    userId: string;
    tenantId: string;
    roles: string[];
    sessionId: string;
  }): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: params.userId,
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience,
      tenantId: params.tenantId,
      roles: params.roles,
      sessionId: params.sessionId,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      issuer: this.jwtConfig.issuer,
      audience: this.jwtConfig.audience,
      expiresIn: this.jwtConfig.accessExpiresIn as never,
    });
  }

  async signRefreshToken(params: {
    userId: string;
    tenantId: string;
    sessionId: string;
  }): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: params.userId,
      sid: params.sessionId,
      tid: params.tenantId,
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience,
      type: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshSecret,
      issuer: this.jwtConfig.issuer,
      audience: this.jwtConfig.audience,
      expiresIn: this.jwtConfig.refreshExpiresIn as never,
    });
  }

  async generateTokenPair(params: {
    userId: string;
    tenantId: string;
    roles: string[];
    sessionId: string;
  }): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(params);
    const refreshToken = await this.signRefreshToken({
      userId: params.userId,
      tenantId: params.tenantId,
      sessionId: params.sessionId,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.jwtConfig.accessExpiresIn,
      refreshTokenExpiresIn: this.jwtConfig.refreshExpiresIn,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.jwtConfig.accessSecret,
          issuer: this.jwtConfig.issuer,
          audience: this.jwtConfig.audience,
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.jwtConfig.refreshSecret,
          issuer: this.jwtConfig.issuer,
          audience: this.jwtConfig.audience,
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  buildRefreshExpiryDate(): Date {
    return new Date(Date.now() + durationToMilliseconds(this.jwtConfig.refreshExpiresIn));
  }

  getAccessSecret(): string {
    return this.jwtConfig.accessSecret;
  }

  getIssuer(): string {
    return this.jwtConfig.issuer;
  }

  getAudience(): string {
    return this.jwtConfig.audience;
  }
}
