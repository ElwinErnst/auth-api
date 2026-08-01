import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetRotationPolicyDto {
  // null disables auto-rotation. Missing = disable.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  rotationIntervalDays?: number | null;
}
