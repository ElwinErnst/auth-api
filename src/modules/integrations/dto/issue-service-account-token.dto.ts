import { IsOptional, IsString, Matches } from 'class-validator';

export class IssueServiceAccountTokenDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tenantSlug?: string;

  @IsString()
  clientAppId!: string;

  @IsString()
  serviceAccountId!: string;

  @IsString()
  clientSecret!: string;
}
