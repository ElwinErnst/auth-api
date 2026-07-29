import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingMeteringService } from '../../common/modules/billing-metering/billing-metering.service';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ClientApp } from './entities/client-app.entity';
import { ServiceAccount } from './entities/service-account.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientApp, ServiceAccount]),
    TenantsModule,
    EntitlementsModule,
    AuthModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, BillingMeteringService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
