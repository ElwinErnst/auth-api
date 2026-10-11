import { IsIn, IsUUID } from 'class-validator';

export class CreateOrganizationMembershipDto {
  @IsUUID()
  userId!: string;

  @IsIn(['OWNER', 'ADMIN'])
  role!: 'OWNER' | 'ADMIN';
}
