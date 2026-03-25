import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.login(dto, { userAgent, ip });
  }

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
    return this.authService.logoutAll(currentAuth);
  }

  @UseGuards(AccessJwtGuard)
  @Get('me')
  me(@CurrentAuth() currentAuth: AccessTokenPayload, @Req() _req: Request) {
    return this.authService.me(currentAuth);
  }
}
