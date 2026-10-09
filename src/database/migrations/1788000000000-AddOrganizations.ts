import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizations1788000000000 implements MigrationInterface {
  name = 'AddOrganizations1788000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(160) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug")
      )
    `);

    await q.query(`
      CREATE TABLE "billing_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" character varying(160) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billing_accounts_organization" UNIQUE ("organization_id"),
        CONSTRAINT "FK_billing_accounts_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    await q.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "uq_organization_membership_user" UNIQUE ("organization_id", "user_id"),
        CONSTRAINT "CK_organization_membership_role" CHECK ("role" IN ('OWNER', 'ADMIN')),
        CONSTRAINT "FK_organization_memberships_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_memberships_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_organization_memberships_user" ON "organization_memberships" ("user_id")`,
    );

    await q.query(`
      CREATE TABLE "organization_tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "uq_organization_tenant" UNIQUE ("organization_id", "tenant_id"),
        CONSTRAINT "uq_tenant_organization_owner" UNIQUE ("tenant_id"),
        CONSTRAINT "FK_organization_tenants_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_tenants_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_organization_tenants_organization" ON "organization_tenants" ("organization_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_organization_tenants_organization"`);
    await q.query(`DROP TABLE "organization_tenants"`);
    await q.query(`DROP INDEX "IDX_organization_memberships_user"`);
    await q.query(`DROP TABLE "organization_memberships"`);
    await q.query(`DROP TABLE "billing_accounts"`);
    await q.query(`DROP TABLE "organizations"`);
  }
}
