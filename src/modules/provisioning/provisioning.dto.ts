import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { API_SCOPES } from '../integrations/api-scopes';

export class ProvisionSaaSRequestDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  organizationName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/)
  organizationSlug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tenantName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/)
  tenantSlug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  applicationName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9-]+$/)
  applicationSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  applicationDescription?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  serviceAccountName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  serviceAccountDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true })
  serviceAccountScopes?: string[];
}
