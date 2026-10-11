import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvisioningOperation } from './provisioning-operation.entity';
import { ProvisioningSecretCipher } from './provisioning-secret-cipher';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProvisioningOperation])],
  providers: [
    ProvisioningService,
    ProvisioningSecretCipher,
    { provide: 'PROVISIONING_CALLER_ID', useValue: 'trusted-sytadel-backend' },
  ],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
