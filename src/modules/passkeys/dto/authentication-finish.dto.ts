import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class AuthenticationFinishDto {
  @IsObject()
  response!: AuthenticationResponseJSON;

  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}
