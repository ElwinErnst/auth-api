import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER'])
  requestedRole!: 'OWNER' | 'ADMIN' | 'MEMBER';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  justification?: string;
}
