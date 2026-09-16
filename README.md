# Sytadel auth-api

Servicio de identidad y directorio multi-tenant: usuarios, tenants, memberships, sesiones y emisión de JWT.

## Qué es (individual)

`auth-api` es un **proveedor de identidad multi-tenant** autocontenido. Por sí solo resuelve:

- registro y login de usuarios con sesiones y refresh token rotation (con detección de reuso)
- passkeys / WebAuthn resistentes a enumeración de cuentas
- modelo tenant → membership → rol (`OWNER` / `ADMIN` / `MEMBER`)
- emisión de JWT tenant-scoped con algoritmo fijado
- un **directorio interno** server-to-server para que otros servicios resuelvan tenants y memberships

Es el único servicio de Sytadel que corre de forma totalmente independiente: solo necesita PostgreSQL. Podés usarlo como el IdP de tu propia app aunque no adoptes el resto de la suite.

## Rol en Sytadel

Dentro de la suite, `auth-api` es la **única fuente de verdad** de `tenants`, `memberships` y roles. Los demás servicios NO tienen foreign keys locales a identidad: la consultan por el directorio interno.

- `zerotrust-api` valida los JWT que emite este servicio y resuelve políticas por tenant
- `vault-api` resuelve tenants/memberships acá antes de tocar datos
- `billing-api` sincroniza entitlements contra este directorio
- `mcp-server` se autentica contra este servicio

Ver la [arquitectura de la suite](../../README.md).

## Responsabilidades

- usuarios, tenants, memberships
- sesiones, refresh token rotation, logout y logout-all
- passkeys / WebAuthn
- emisión de JWT para `zerotrust-api`
- endpoints internos para consulta de tenants y memberships desde otros servicios

## Endpoints principales

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET  /api/auth/me`

## Endpoints internos

Pensados para uso server-to-server (protegidos por secreto + HMAC compartido, no para exposición pública):

- `GET /api/internal/tenants/:id`
- `GET /api/internal/memberships/resolve?userId=...&tenantId=...`
- `GET /api/internal/users/:userId/tenants`

## Uso standalone

```bash
cp .env.example .env
yarn install
yarn start:dev        # http://localhost:3002/api (dev)
```

Modo producción local:

```bash
yarn build
yarn start:prod
```

Necesita una PostgreSQL alcanzable (`DB_HOST` … `DB_NAME`). Con `AUTH_BOOTSTRAP_DEMO_DATA=true` siembra datos demo locales (ver más abajo). El campo `BILLING_METERING_BASE_URL` es opcional: si no lo apuntás a un billing, la medición queda inactiva sin romper el servicio.

## Uso en la suite

Desde la raíz del meta-repo, `docker compose up --build` lo levanta junto con el resto. En la red interna del compose responde en `http://auth-api:3001/api` (publicado hacia el host en `http://localhost:3002/api`). Los demás servicios lo alcanzan vía `AUTH_DIRECTORY_BASE_URL=http://auth-api:3001/api`.

## Demo seed

Si `AUTH_BOOTSTRAP_DEMO_DATA=true`, al arrancar crea:

- tenant `sentinel-labs`
- user `admin@test.com`
- password `123456`
- membership `OWNER`

Son datos locales, no secretos. No habilitar el bootstrap demo en ningún entorno compartido.

## JWT

- algoritmo: `HS256` (fijado, sin `alg:none`)
- issuer: `auth`
- audience esperada: `zerotrust-api`
- access token corto + refresh token rotativo con detección de reuso

## Base de datos

- PostgreSQL + TypeORM
- el schema es propiedad de las migraciones: `migrationsRun: true` en el arranque
- `synchronize` está OFF por defecto; `DB_SYNC=true` es sólo para experimentación local descartable, nunca en el stack

## Notas

- si cambia la autoridad de tenants/memberships, este servicio debe seguir siendo el dueño del dato

## Licencia

Apache-2.0. Ver [LICENSE](./LICENSE).
