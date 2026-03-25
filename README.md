# SentinelSuite auth-api

Auth multi-tenant con:

- usuarios
- tenants
- memberships
- sesiones
- refresh token rotation
- logout y logout-all
- `/auth/me`

## Endpoints principales

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/me`

## Setup

```bash
cp .env.example .env
npm install
npm run start:dev
```

## Demo seed

Si `AUTH_BOOTSTRAP_DEMO_DATA=true`, al arrancar crea:

- tenant `sentinel-labs`
- user `admin@test.com`
- password `123456`
- membership `OWNER`

## Notas

- JWT: HS256
- DB: PostgreSQL + TypeORM
- `DB_SYNC=true` para desarrollo. Para producción, usar migraciones.
