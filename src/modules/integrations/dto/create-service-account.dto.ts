import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { API_SCOPES } from '../api-scopes';

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

  // Scopes to grant this key. Validated against the closed allowlist. When
  // omitted, the key is created least-privilege (no scopes) and can be granted
  // scopes later via update.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true })
  scopes?: string[];
}
