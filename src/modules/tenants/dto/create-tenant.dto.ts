import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @IsBoolean()
  ztPoliciesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vaultsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxVaults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyNotaryRequests?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  auditRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxClientApps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxServiceAccounts?: number;

  @IsOptional()
  @IsArray()
  @IsIn(['AUTH_API', 'VAULT_API', 'ZERO_TRUST_API'], { each: true })
  apiAddons?: Array<'AUTH_API' | 'VAULT_API' | 'ZERO_TRUST_API'>;

  @IsOptional()
  @IsBoolean()
  billingBypass?: boolean;
}
