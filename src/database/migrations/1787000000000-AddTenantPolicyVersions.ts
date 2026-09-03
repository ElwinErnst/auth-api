import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantPolicyVersions1787000000000 implements MigrationInterface {
  name = 'AddTenantPolicyVersions1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tenant_policy_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "policy_set" jsonb NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'published',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_policy_versions_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_policy_versions_tenant_status" ON "tenant_policy_versions" ("tenant_id", "status")`,
    );
    // At most one published policy per tenant.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tenant_policy_versions_one_published" ON "tenant_policy_versions" ("tenant_id") WHERE "status" = 'published'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tenant_policy_versions_tenant_version" ON "tenant_policy_versions" ("tenant_id", "version")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_tenant_policy_versions_tenant_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_tenant_policy_versions_one_published"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tenant_policy_versions_tenant_status"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_policy_versions"`);
  }
}
