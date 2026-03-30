# Sentinel Suite auth-api

Servicio de identidad y directorio multi-tenant.

## Responsabilidades

- usuarios
- tenants
- memberships
- sesiones
- refresh token rotation
- logout y logout-all
- emisión de JWT para `zerotrust-api`
- endpoints internos para consulta de tenants y memberships desde otros servicios

## Estado arquitectónico

`auth-api` es la fuente de verdad de:

- `tenants`
- `memberships`
- roles por tenant

`vault-api` ya consume esta información mediante endpoints internos protegidos por secreto compartido.

## Endpoints principales

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/me`

## Endpoints internos

Pensados para uso server-to-server:

- `GET /api/internal/tenants/:id`
- `GET /api/internal/memberships/resolve?userId=...&tenantId=...`
- `GET /api/internal/users/:userId/tenants`

Protección:

- header interno con secreto compartido
- no pensados para exposición pública

## Setup local

```bash
cp .env.example .env
yarn install
yarn start:dev
```

Modo producción local:

```bash
yarn build
yarn start:prod
```

## Demo seed

Si `AUTH_BOOTSTRAP_DEMO_DATA=true`, al arrancar crea:

- tenant `sentinel-labs`
- user `admin@test.com`
- password `123456`
- membership `OWNER`

## JWT

- algoritmo: `HS256`
- issuer: `auth`
- audience esperada: `zerotrust-api`
- access token corto
- refresh token rotativo

## Notas

- DB: PostgreSQL + TypeORM
- `DB_SYNC=true` sólo para desarrollo
- para producción conviene migraciones explícitas
- si cambia la autoridad de tenants/memberships, este servicio debe seguir siendo el dueño del dato
