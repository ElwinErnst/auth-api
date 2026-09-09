import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateServiceAccountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Environment this key belongs to. When omitted, the key is assigned to the
  // app's `production` environment (the safe default preserves current
  // single-environment behaviour).
  @IsOptional()
  @IsUUID()
  environmentId?: string;
}
