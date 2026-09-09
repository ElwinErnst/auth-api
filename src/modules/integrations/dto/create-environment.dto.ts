import { IsIn } from 'class-validator';
import type { EnvironmentName } from '../entities/environment.entity';

export class CreateEnvironmentDto {
  @IsIn(['development', 'staging', 'production'])
  name!: EnvironmentName;
}
