import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenamePasskeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  friendlyName!: string;
}
