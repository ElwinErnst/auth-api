import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceAccountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
