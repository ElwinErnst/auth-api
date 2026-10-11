import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BillingAccount } from '../organizations/entities/billing-account.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { OrganizationTenant } from '../organizations/entities/organization-tenant.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TenantMembership } from '../memberships/entities/tenant-membership.entity';
import { ClientApp } from '../integrations/entities/client-app.entity';
import { Environment } from '../integrations/entities/environment.entity';
import { ServiceAccount } from '../integrations/entities/service-account.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { ProvisionSaaSRequestDto } from './provisioning.dto';
import { ProvisioningOperation } from './provisioning-operation.entity';
import { ProvisioningSecretCipher } from './provisioning-secret-cipher';
import { ProvisioningService } from './provisioning.service';

const entities = [
  ProvisioningOperation,
  Organization,
  BillingAccount,
  OrganizationMembership,
  Tenant,
  TenantMembership,
  OrganizationTenant,
  ClientApp,
  Environment,
  ServiceAccount,
  User,
];

class ProvisioningStore {
  rows = new Map<Function, any[]>(entities.map((entity) => [entity, []]));
  tail: Promise<void> = Promise.resolve();
  failEnvironmentSave = false;

  repository(entity: Function): Repository<any> {
    const getRows = () => this.rows.get(entity)!;
    const matches = (row: any, where: any) =>
      Object.entries(where ?? {}).every(([key, value]) => row[key] === value);
    const uniqueConflict = () =>
      Object.assign(new Error('unique conflict'), {
        driverError: { code: '23505' },
      });
    const uniqueFields = new Map<Function, string[][]>([
      [ProvisioningOperation, [['callerId', 'idempotencyKey']]],
      [Organization, [['slug']]],
      [BillingAccount, [['organizationId']]],
      [OrganizationMembership, [['organizationId', 'userId']]],
      [Tenant, [['slug']]],
      [TenantMembership, [['userId', 'tenantId']]],
      [OrganizationTenant, [['tenantId']]],
      [ClientApp, [['tenantId', 'slug']]],
      [Environment, [['clientAppId', 'name']]],
    ]);
    const checkUnique = (candidate: any, current?: any) => {
      for (const fields of uniqueFields.get(entity) ?? []) {
        if (
          getRows().some(
            (row) =>
              row !== current &&
              fields.every((field) => row[field] === candidate[field]),
          )
        ) {
          throw uniqueConflict();
        }
      }
    };
    return {
      create: (value: any) => ({ ...value }),
      findOne: async (options: any) =>
        getRows().find((row) => matches(row, options?.where)) ?? null,
      findOneBy: async (where: any) =>
        getRows().find((row) => matches(row, where)) ?? null,
      insert: async (value: any) => {
        await Promise.resolve();
        checkUnique(value);
        getRows().push({ ...value, id: randomUUID() });
        return { identifiers: [] };
      },
      save: async (value: any) => {
        if (entity === Environment && this.failEnvironmentSave) {
          this.failEnvironmentSave = false;
          throw new Error('simulated environment insert failure');
        }
        const existing = value.id
          ? getRows().find((row) => row.id === value.id)
          : undefined;
        checkUnique(value, existing);
        if (existing) {
          Object.assign(existing, value);
          return existing;
        }
        const saved = { ...value, id: value.id ?? randomUUID() };
        getRows().push(saved);
        return saved;
      },
      update: async (where: any, partial: any) => {
        const row = getRows().find((item) => matches(item, where));
        if (row) {
          for (const [key, value] of Object.entries(partial)) {
            row[key] = typeof value === 'function' ? row[key] + 1 : value;
          }
        }
        return { affected: row ? 1 : 0 };
      },
    } as unknown as Repository<any>;
  }

  dataSource(): DataSource {
    return {
      transaction: async (callback: (manager: EntityManager) => Promise<any>) => {
        const previous = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>((resolve) => (release = resolve));
        await previous;
        const before = new Map(
          [...this.rows].map(([entity, rows]) => [
            entity,
            rows.map((row) => ({ ...row })),
          ]),
        );
        try {
          const manager = {
            getRepository: (entity: Function) => this.repository(entity),
          } as unknown as EntityManager;
          return await callback(manager);
        } catch (error) {
          this.rows = before;
          throw error;
        } finally {
          release();
        }
      },
    } as unknown as DataSource;
  }
}

function request(overrides: Partial<ProvisionSaaSRequestDto> = {}) {
  return {
    idempotencyKey: randomUUID(),
    ownerUserId: 'owner-user',
    organizationName: 'Acme',
    organizationSlug: 'acme',
    tenantName: 'Acme Customer',
    tenantSlug: 'acme-customer',
    applicationName: 'Acme App',
    applicationSlug: 'acme-app',
    serviceAccountName: 'acme-provisioner',
    serviceAccountScopes: ['payments:read'],
    ...overrides,
  } as ProvisionSaaSRequestDto;
}

function setup(callerId = 'trusted-sytadel-backend') {
  const store = new ProvisioningStore();
  store.rows.get(User)!.push({ id: 'owner-user', isActive: true });
  const key = Buffer.alloc(32, 7).toString('base64');
  const cipher = new ProvisioningSecretCipher({
    get: () => key,
  } as any);
  const service = new ProvisioningService(
    store.dataSource(),
    store.repository(ProvisioningOperation),
    cipher,
    callerId,
  );
  return { service, store };
}

describe('ProvisioningService', () => {
  it('replays the same resources and credential without persisting plaintext', async () => {
    const { service, store } = setup();
    const dto = request();

    const first = await service.provision(dto);
    const replay = await service.provision(dto);
    const operation = store.rows.get(ProvisioningOperation)![0];

    expect(first.status).toBe('COMPLETED');
    expect(replay.resources).toEqual(first.resources);
    expect(replay.clientSecret).toBe(first.clientSecret);
    expect(operation.encryptedClientSecret).not.toContain(first.clientSecret);
    expect(store.rows.get(Organization)).toHaveLength(1);
    expect(store.rows.get(Tenant)).toHaveLength(1);
    expect(store.rows.get(Tenant)![0]).toMatchObject({
      planCode: 'FREE',
      apiAddons: [],
      billingBypass: false,
    });
    expect(store.rows.get(ClientApp)).toHaveLength(1);
    expect(store.rows.get(Environment)).toHaveLength(1);
    expect(store.rows.get(ServiceAccount)).toHaveLength(1);

    const status = await service.getStatus(dto.idempotencyKey);
    expect(status.status).toBe('COMPLETED');
    expect(status).not.toHaveProperty('clientSecret');
    expect(status).not.toHaveProperty('encryptedClientSecret');
  });

  it('serializes concurrent retries of the same key into one provisioned graph', async () => {
    const { service, store } = setup();
    const dto = request();
    const [first, second] = await Promise.all([
      service.provision(dto),
      service.provision(dto),
    ]);

    expect(second.resources).toEqual(first.resources);
    expect(second.clientSecret).toBe(first.clientSecret);
    expect(store.rows.get(Organization)).toHaveLength(1);
    expect(store.rows.get(TenantMembership)).toHaveLength(1);
    expect(store.rows.get(ServiceAccount)).toHaveLength(1);
  });

  it('records a failed step and safely retries after transaction rollback', async () => {
    const { service, store } = setup();
    const dto = request();
    store.failEnvironmentSave = true;

    await expect(service.provision(dto)).rejects.toThrow(
      'SaaS provisioning failed',
    );
    const failed = store.rows.get(ProvisioningOperation)![0];
    expect(failed.status).toBe('FAILED');
    expect(failed.currentStep).toBe('CREATE_PRODUCTION_ENVIRONMENT');
    expect(failed.lastErrorCode).toBe('PROVISIONING_FAILED');
    expect(store.rows.get(Organization)).toHaveLength(0);
    expect(store.rows.get(Tenant)).toHaveLength(0);

    const retried = await service.provision(dto);
    expect(retried.status).toBe('COMPLETED');
    expect(store.rows.get(Organization)).toHaveLength(1);
    expect(store.rows.get(ServiceAccount)).toHaveLength(1);
  });

  it('does not let a failed concurrent attempt overwrite a completed retry', async () => {
    const { service, store } = setup();
    const dto = request();
    store.failEnvironmentSave = true;

    const results = await Promise.allSettled([
      service.provision(dto),
      service.provision(dto),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const status = await service.getStatus(dto.idempotencyKey);
    expect(status.status).toBe('COMPLETED');
    expect(store.rows.get(Organization)).toHaveLength(1);
    expect(store.rows.get(ServiceAccount)).toHaveLength(1);
  });

  it('rejects reuse of a key for changed input and isolates caller namespaces', async () => {
    const firstCaller = setup('trusted-sytadel-backend');
    const secondCaller = new ProvisioningService(
      firstCaller.store.dataSource(),
      firstCaller.store.repository(ProvisioningOperation),
      new ProvisioningSecretCipher({
        get: () => Buffer.alloc(32, 7).toString('base64'),
      } as any),
      'another-trusted-internal-caller',
    );
    const key = randomUUID();
    const first = await firstCaller.service.provision(request({ idempotencyKey: key }));
    await expect(
      firstCaller.service.provision(
        request({ idempotencyKey: key, tenantName: 'Changed' }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(secondCaller.getStatus(key)).rejects.toThrow(
      'Provisioning operation not found',
    );

    const second = await secondCaller.provision(
      request({
        idempotencyKey: key,
        organizationName: 'Other Org',
        organizationSlug: 'other-org',
        tenantName: 'Other Tenant',
        tenantSlug: 'other-tenant',
        applicationName: 'Other App',
        applicationSlug: 'other-app',
        serviceAccountName: 'other-provisioner',
      }),
    );
    expect(second.operationId).not.toBe(first.operationId);
    expect(second.resources.tenantId).not.toBe(first.resources.tenantId);
    expect(second.clientSecret).not.toBe(first.clientSecret);
  });
});
