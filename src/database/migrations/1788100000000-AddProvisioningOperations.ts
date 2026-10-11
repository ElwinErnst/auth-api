import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProvisioningOperations1788100000000
  implements MigrationInterface
{
  name = 'AddProvisioningOperations1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "provisioning_operations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "caller_id" character varying(80) NOT NULL,
        "idempotency_key" character varying(120) NOT NULL,
        "request_hash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "current_step" character varying(64) NOT NULL DEFAULT 'PENDING',
        "last_error_code" character varying(64),
        "attempt_count" integer NOT NULL DEFAULT 0,
        "organization_id" uuid,
        "billing_account_id" uuid,
        "tenant_id" uuid,
        "client_app_id" uuid,
        "environment_id" uuid,
        "service_account_id" uuid,
        "encrypted_client_secret" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provisioning_operations" PRIMARY KEY ("id"),
        CONSTRAINT "CK_provisioning_operations_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'FAILED', 'COMPLETED'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_provisioning_operations_caller_key" ON "provisioning_operations" ("caller_id", "idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provisioning_operations_status" ON "provisioning_operations" ("status", "updated_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_client_apps_tenant_slug" ON "client_apps" ("tenant_id", "slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_client_apps_tenant_slug"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provisioning_operations_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_provisioning_operations_caller_key"`,
    );
    await queryRunner.query(`DROP TABLE "provisioning_operations"`);
  }
}
