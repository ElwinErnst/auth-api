import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * TypeORM DataSource used by the CLI (migration:generate / run / revert).
 * Entities are picked up by glob so every `*.entity.ts` is included — the
 * generated baseline must cover the whole schema, not a hand-maintained subset.
 * The running app configures TypeORM separately in app.module.ts.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5434),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'auth',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
