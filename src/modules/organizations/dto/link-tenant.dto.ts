import { IsUUID } from 'class-validator';

export class LinkTenantDto {
  @IsUUID()
  tenantId!: string;
}
