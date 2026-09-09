import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { API_SCOPES } from '../api-scopes';

export class UpdateServiceAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Replace the key's scopes wholesale. Validated against the allowlist.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true })
  scopes?: string[];
}
