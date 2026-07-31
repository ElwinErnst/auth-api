import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { PasskeysService } from './passkeys.service';
import { AuthenticationBeginDto } from './dto/authentication-begin.dto';
import { AuthenticationFinishDto } from './dto/authentication-finish.dto';
import { RegistrationFinishDto } from './dto/registration-finish.dto';
import { RenamePasskeyDto } from './dto/rename-passkey.dto';

@Controller('passkeys')
export class PasskeysController {
  constructor(private readonly passkeys: PasskeysService) {}

  // ── Registration (requires an active session) ──────────────────

  @UseGuards(AccessJwtGuard)
  @Post('registration/begin')
  registrationBegin(@CurrentAuth() auth: AccessTokenPayload) {
    return this.passkeys.registrationBegin(auth.sub);
  }

  @UseGuards(AccessJwtGuard)
  @Post('registration/finish')
  registrationFinish(
    @CurrentAuth() auth: AccessTokenPayload,
    @Body() dto: RegistrationFinishDto,
  ) {
    return this.passkeys.registrationFinish(
      auth.sub,
      dto.response,
      dto.friendlyName,
    );
  }

  // ── Authentication (public) ────────────────────────────────────

  @HttpCode(200)
  @Post('authentication/begin')
  authenticationBegin(@Body() dto: AuthenticationBeginDto) {
    return this.passkeys.authenticationBegin(dto.email, dto.tenantSlug);
  }

  @HttpCode(200)
  @Post('authentication/finish')
  authenticationFinish(
    @Body() dto: AuthenticationFinishDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.passkeys.authenticationFinish(dto.response, dto.tenantSlug, {
      userAgent,
      ip,
    });
  }

  // ── Management ─────────────────────────────────────────────────

  @UseGuards(AccessJwtGuard)
  @Get()
  list(@CurrentAuth() auth: AccessTokenPayload) {
    return this.passkeys.list(auth.sub);
  }

  @UseGuards(AccessJwtGuard)
  @Patch(':id')
  rename(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RenamePasskeyDto,
  ) {
    return this.passkeys.rename(auth.sub, id, dto.friendlyName);
  }

  @UseGuards(AccessJwtGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.passkeys.remove(auth.sub, id);
  }
}
