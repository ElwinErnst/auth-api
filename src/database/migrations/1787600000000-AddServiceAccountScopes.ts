import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MA-2 — Service-account scopes.
 *
 * Adds a `scopes` column to service accounts (stored comma-joined, TypeORM
 * simple-array). Backward-compatible: existing keys are backfilled to the broad
 * legacy scope set so current callers keep working once enforcement lands. New
 * keys are created least-privilege by the application layer.
 */
export class AddServiceAccountScopes1787600000000
  implements MigrationInterface
{
  name = 'AddServiceAccountScopes1787600000000';

  // Keep in sync with LEGACY_SCOPE_SET in src/modules/integrations/api-scopes.ts
  private static readonly LEGACY_SCOPES = [
    'payments:create',
    'payments:read',
    'subscriptions:create',
    'subscriptions:read',
    'refunds:create',
    'usage:write',
    'usage:read',
    'webhooks:manage',
    'billing:read',
  ].join(',');

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_accounts" ADD COLUMN "scopes" text`,
    );
    await queryRunner.query(
      `UPDATE "service_accounts" SET "scopes" = $1 WHERE "scopes" IS NULL`,
      [AddServiceAccountScopes1787600000000.LEGACY_SCOPES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_accounts" DROP COLUMN "scopes"`,
    );
  }
}
