import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1786433978858 implements MigrationInterface {
  name = 'Init1786433978858';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "family_id" uuid NOT NULL, "refresh_token_hash" text NOT NULL, "user_agent" text, "ip" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_session_id" uuid, "revoked_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_22aa22eb69a1e6826a1f58902d" ON "sessions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f61929073858aa9cb9cb893b66" ON "sessions" ("family_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "plan_code" character varying NOT NULL DEFAULT 'FREE', "zt_policies_enabled" boolean NOT NULL DEFAULT false, "vaults_enabled" boolean NOT NULL DEFAULT false, "max_vaults" integer NOT NULL DEFAULT '0', "max_users" integer, "monthly_notary_requests" integer NOT NULL DEFAULT '0', "audit_retention_days" integer NOT NULL DEFAULT '30', "max_client_apps" integer NOT NULL DEFAULT '0', "max_service_accounts" integer NOT NULL DEFAULT '0', "api_addons" text, "billing_bypass" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_membership_user_tenant" UNIQUE ("user_id", "tenant_id"), CONSTRAINT "PK_706d16104745b32d75df5836135" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7427b391abdef33b40124c1582" ON "tenant_memberships" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d22937ebccd641b5090849e51f" ON "tenant_memberships" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" text NOT NULL, "password_hash" text NOT NULL, "first_name" text, "last_name" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "session_anomaly_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "tenant_id" uuid, "session_id" uuid, "ip" text, "country" character varying(3), "city" character varying(120), "user_agent" text, "score" integer NOT NULL, "flags" jsonb NOT NULL DEFAULT '[]', "severity" character varying(16) NOT NULL, "login_kind" character varying(40) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1b66fd0fce510793acc2a2be2b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5ba28315b7f90c1a2e111eb614" ON "session_anomaly_events" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "session_anomaly_classifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "label" character varying(16), "confidence" numeric(3,2), "rationale" text, "recommended_action" character varying(32), "model" character varying(64), "input_tokens" integer, "output_tokens" integer, "latency_ms" integer, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3ea90c62947a2f64fb6752697f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92df318767b3a076247a949655" ON "session_anomaly_classifications" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88f7705ab9676901cf52783b95" ON "session_anomaly_classifications" ("event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "webauthn_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(16) NOT NULL, "user_id" uuid, "challenge" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e2946be78aa4435a952618a944d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03a1fd625909713af1fa0b33f3" ON "webauthn_challenges" ("challenge") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_passkeys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "credential_id" bytea NOT NULL, "public_key" bytea NOT NULL, "counter" bigint NOT NULL DEFAULT '0', "transports" text array NOT NULL DEFAULT '{}', "device_type" character varying(20) NOT NULL, "backed_up" boolean NOT NULL DEFAULT false, "friendly_name" character varying(80) NOT NULL, "last_used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f78c7964dfa3e33810747ce0797" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ae2ba540ba966ae1c024944aec" ON "user_passkeys" ("credential_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_506409cf4389eadf21448ba96c" ON "user_passkeys" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "client_apps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text, "created_by_user_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bbd706d9ce0b0e22ab367c64384" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "client_app_id" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "secret_hash" character varying NOT NULL, "secret_preview" character varying NOT NULL, "created_by_user_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "last_used_at" TIMESTAMP, "failed_auth_attempts" integer NOT NULL DEFAULT '0', "auth_blocked_until" TIMESTAMP, "rotation_interval_days" integer, "next_rotation_at" TIMESTAMP WITH TIME ZONE, "previous_secret_hash" text, "previous_secret_expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e2fb216fdc1db94c5e4da7d88fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_access_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "trigger" character varying(32) NOT NULL, "status" character varying(16) NOT NULL, "report_md" text, "recommendations" jsonb NOT NULL DEFAULT '[]', "snapshot" jsonb, "model" character varying(64), "input_tokens" integer, "output_tokens" integer, "latency_ms" integer, "cost_usd" numeric(10,5), "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5667e1ef794a7278036ba807950" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_321816d77a691f9256a767490c" ON "tenant_access_reviews" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "access_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "requester_user_id" uuid NOT NULL, "requested_role" character varying(20) NOT NULL, "justification" text, "status" character varying(16) NOT NULL DEFAULT 'pending', "agent_proposal" jsonb, "agent_model" character varying(64), "decided_by_user_id" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f89e51c15e3dbea13aa248fe128" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e8b960366cd86e9da5f11d7ee" ON "access_requests" ("tenant_id", "status", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_22aa22eb69a1e6826a1f58902d1" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" ADD CONSTRAINT "FK_7427b391abdef33b40124c15822" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" ADD CONSTRAINT "FK_d22937ebccd641b5090849e51f7" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_anomaly_events" ADD CONSTRAINT "FK_31e7eeb98f20cb936c443739272" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_anomaly_classifications" ADD CONSTRAINT "FK_88f7705ab9676901cf52783b957" FOREIGN KEY ("event_id") REFERENCES "session_anomaly_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_passkeys" ADD CONSTRAINT "FK_506409cf4389eadf21448ba96cc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "client_apps" ADD CONSTRAINT "FK_2d737ac708b973c4b37a8616776" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_accounts" ADD CONSTRAINT "FK_b58e400110113713f38cf04fc2e" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_accounts" ADD CONSTRAINT "FK_e9a8acee9e8fee7aeeb13ebc679" FOREIGN KEY ("client_app_id") REFERENCES "client_apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_accounts" DROP CONSTRAINT "FK_e9a8acee9e8fee7aeeb13ebc679"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_accounts" DROP CONSTRAINT "FK_b58e400110113713f38cf04fc2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "client_apps" DROP CONSTRAINT "FK_2d737ac708b973c4b37a8616776"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_passkeys" DROP CONSTRAINT "FK_506409cf4389eadf21448ba96cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_anomaly_classifications" DROP CONSTRAINT "FK_88f7705ab9676901cf52783b957"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_anomaly_events" DROP CONSTRAINT "FK_31e7eeb98f20cb936c443739272"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_d22937ebccd641b5090849e51f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_7427b391abdef33b40124c15822"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_22aa22eb69a1e6826a1f58902d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e8b960366cd86e9da5f11d7ee"`,
    );
    await queryRunner.query(`DROP TABLE "access_requests"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_321816d77a691f9256a767490c"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_access_reviews"`);
    await queryRunner.query(`DROP TABLE "service_accounts"`);
    await queryRunner.query(`DROP TABLE "client_apps"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_506409cf4389eadf21448ba96c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae2ba540ba966ae1c024944aec"`,
    );
    await queryRunner.query(`DROP TABLE "user_passkeys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03a1fd625909713af1fa0b33f3"`,
    );
    await queryRunner.query(`DROP TABLE "webauthn_challenges"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88f7705ab9676901cf52783b95"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92df318767b3a076247a949655"`,
    );
    await queryRunner.query(`DROP TABLE "session_anomaly_classifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ba28315b7f90c1a2e111eb614"`,
    );
    await queryRunner.query(`DROP TABLE "session_anomaly_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d22937ebccd641b5090849e51f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7427b391abdef33b40124c1582"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_memberships"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f61929073858aa9cb9cb893b66"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_22aa22eb69a1e6826a1f58902d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_085d540d9f418cfbdc7bd55bb1"`,
    );
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
