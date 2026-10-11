import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AuthorizePlatformSubscriptionDto {
  @IsUUID()
  actorUserId!: string;

  @IsUUID()
  billingAccountId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(250)
  @IsUUID('all', { each: true })
  coveredTenantIds!: string[];
}
