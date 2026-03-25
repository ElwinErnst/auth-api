import { IsIn, IsString } from 'class-validator';

export class CreateMembershipDto {
  @IsString()
  userId!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER'])
  role!: 'OWNER' | 'ADMIN' | 'MEMBER';
}
