import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class RegistrationFinishDto {
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  friendlyName!: string;
}
