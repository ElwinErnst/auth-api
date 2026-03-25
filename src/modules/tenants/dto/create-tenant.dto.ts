import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
