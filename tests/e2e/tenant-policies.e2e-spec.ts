import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createHash, createHmac, randomUUID } from 'crypto';
import { AppModule } from '../../src/app.module';

const INTERNAL_SERVICE_SECRET = 'change-me-internal-secret';
const INTERNAL_HMAC_SECRET = 'change-me-internal-hmac-secret';

const validPolicy = {
  version: 1,
  rules: [
    {
      description: 'allow vault document reads',
      effect: 'allow',
      when: { upstream: 'vault', methods: ['GET'], pathGlob: '/documents*' },
    },
  ],
  default: 'deny',
};

function tenantIdFromToken(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
  ) as { tenantId: string };
  return payload.tenantId;
}

function internalGetHeaders(pathWithQuery: string): Record<string, string> {
  const ts = String(Date.now());
  const nonce = randomUUID();
  // GET with no body → Express req.body is {} → JSON.stringify({}) === '{}'.
  const bodySha256Hex = createHash('sha256').update('{}').digest('hex');
  const canonical = ['GET', pathWithQuery, bodySha256Hex, ts, nonce].join('\n');
  const signature = createHmac('sha256', INTERNAL_HMAC_SECRET)
    .update(canonical)
    .digest('hex');
  return {
    'x-internal-service-secret': INTERNAL_SERVICE_SECRET,
    'x-internal-service-ts': ts,
    'x-internal-service-nonce': nonce,
    'x-internal-service-signature': signature,
  };
}

describe('Tenant policies (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const login = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: '123456', tenantSlug: 'sentinel-labs' });

  async function tokenFor(email: string): Promise<string> {
    const res = await login(email);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await dataSource.query('DELETE FROM tenant_policy_versions');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('OWNER publishes v1, then reads it back', async () => {
    const token = await tokenFor('admin@test.com');
    const tenantId = tenantIdFromToken(token);

    const put = await request(app.getHttpServer())
      .put(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPolicy);
    expect(put.status).toBe(200);
    expect(put.body.version).toBe(1);

    const get = await request(app.getHttpServer())
      .get(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.version).toBe(1);
    expect(get.body.policySet).toEqual(validPolicy);
  });

  it('publishing again increments the version', async () => {
    const token = await tokenFor('admin@test.com');
    const tenantId = tenantIdFromToken(token);

    const put = await request(app.getHttpServer())
      .put(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPolicy, default: 'allow' });
    expect(put.status).toBe(200);
    expect(put.body.version).toBe(2);
  });

  it('rejects an invalid policy set (400)', async () => {
    const token = await tokenFor('admin@test.com');
    const tenantId = tenantIdFromToken(token);

    const res = await request(app.getHttpServer())
      .put(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ version: 1, rules: [], default: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('rejects a request without a token (401)', async () => {
    const token = await tokenFor('admin@test.com');
    const tenantId = tenantIdFromToken(token);

    await request(app.getHttpServer())
      .get(`/api/tenants/${tenantId}/policy`)
      .expect(401);
  });

  it('rejects cross-tenant access (403)', async () => {
    const token = await tokenFor('admin@test.com');
    const otherTenant = '00000000-0000-0000-0000-0000000000ff';

    await request(app.getHttpServer())
      .put(`/api/tenants/${otherTenant}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPolicy)
      .expect(403);
  });

  it('rejects a MEMBER (403)', async () => {
    const token = await tokenFor('member@test.com');
    const tenantId = tenantIdFromToken(token);

    await request(app.getHttpServer())
      .put(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPolicy)
      .expect(403);
  });

  it('serves the published policy to the internal signed channel', async () => {
    const token = await tokenFor('admin@test.com');
    const tenantId = tenantIdFromToken(token);

    // Ensure something is published.
    await request(app.getHttpServer())
      .put(`/api/tenants/${tenantId}/policy`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPolicy);

    const path = `/api/internal/tenants/${tenantId}/policy`;
    const res = await request(app.getHttpServer())
      .get(path)
      .set(internalGetHeaders(path));

    expect(res.status).toBe(200);
    expect(res.body.policySet).toEqual(validPolicy);
  });
});
