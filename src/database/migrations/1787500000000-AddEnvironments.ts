import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MA-1 — Environment domain.
 *
 * Adds the `environments` table (a deployment tier below the application) and
 * links service accounts to an environment. Fully backward-compatible:
 *  - every existing client app gets a `production` environment autocreated;
 *  - `service_accounts.environment_id` is nullable and backfilled to each
 *    account's app `production` environment, so pre-existing keys keep working.
 */
export class AddEnvironments1787500000000 implements MigrationInterface {
  name = 'AddEnvironments1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "environments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "client_app_id" uuid NOT NULL,
        "name" character varying(20) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_environments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_environments_client_app" FOREIGN KEY ("client_app_id")
          REFERENCES "client_apps"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_environments_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )`,
    );
    // One environment of each name per application.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_environments_client_app_name" ON "environments" ("client_app_id", "name")`,
    );

    // Backfill: a `production` environment for every existing application.
    await queryRunner.query(
      `INSERT INTO "environments" ("tenant_id", "client_app_id", "name", "slug")
       SELECT "tenant_id", "id", 'production', "slug" || '-production'
       FROM "client_apps"`,
    );

    // Link service accounts to an environment (nullable for compatibility).
    await queryRunner.query(
      `ALTER TABLE "service_accounts" ADD COLUMN "environment_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_accounts"
        ADD CONSTRAINT "FK_service_accounts_environment"
        FOREIGN KEY ("environment_id") REFERENCES "environments"("id")
        ON DELETE SET NULL`,
    );

    // Backfill: point every existing key at its app's production environment.
    await queryRunner.query(
      `UPDATE "service_accounts" sa
       SET "environment_id" = e."id"
       FROM "environments" e
       WHERE e."client_app_id" = sa."client_app_id"
         AND e."name" = 'production'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_accounts" DROP CONSTRAINT "FK_service_accounts_environment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_accounts" DROP COLUMN "environment_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_environments_client_app_name"`,
    );
    await queryRunner.query(`DROP TABLE "environments"`);
  }
}
