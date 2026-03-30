# Tests e2e para auth-api

## Objetivo

Cubrir el flujo principal de identidad y sesiones:

- login
- `me`
- refresh
- reuse detection del refresh viejo
- logout
- logout-all
- credenciales inválidas
- tenant inválido

## Dependencias

Si el proyecto todavía no las tiene instaladas:

```bash
yarn add -D jest ts-jest @types/jest supertest @types/supertest
```

## Script sugerido

```json
{
  "scripts": {
    "test:e2e": "jest --config ./tests/jest-e2e.json --runInBand"
  }
}
```

## Antes de correr

1. levantá PostgreSQL de `auth-api`
2. asegurate de tener seed demo o fixtures equivalentes
3. si usás env separado de tests, copiá `tests/.env.test.example` a `.env.test`

Dataset demo esperado:

- `admin@test.com`
- tenant `sentinel-labs`
- membership `OWNER`

## Ejecutar

```bash
yarn test:e2e
```

## Sugerencia

Como `auth-api` ahora es la fuente de verdad de tenants y memberships, conviene sumar e2e para:

- resolución de memberships
- listado de tenants del usuario
- endpoints internos protegidos por secreto compartido
