import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateMembershipDto {
  @IsOptional()
  @IsString()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER'])
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
