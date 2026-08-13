import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AccessTokenPayload } from './types/access-token-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Credential brute-force guard: much stricter than the global 300/min. bcrypt
  // slows each guess; this caps the volume per IP on top of that.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.login(dto, { userAgent, ip });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.refresh(dto, { userAgent, ip });
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }
  @UseGuards(AccessJwtGuard)
  @Post('logout-all')
  logoutAll(@CurrentAuth() currentAuth: AccessTokenPayload) {
    return this.authService.logoutAll(currentAuth.sub);
  }

  @UseGuards(AccessJwtGuard)
  @Get('me')
  me(@CurrentAuth() currentAuth: AccessTokenPayload) {
    return this.authService.me(
      currentAuth.sub,
      currentAuth.tenantId,
      currentAuth.sessionId,
    );
  }
}
