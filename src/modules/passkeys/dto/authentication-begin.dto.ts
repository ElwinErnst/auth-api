import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AuthenticationBeginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}
