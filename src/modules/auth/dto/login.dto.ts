import {
  IsEmail,
  // IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @ValidateIf((o: LoginDto) => !o.tenantSlug)
  @IsString()
  tenantId?: string;

  @ValidateIf((o: LoginDto) => !o.tenantId)
  @IsString()
  tenantSlug?: string;
}
