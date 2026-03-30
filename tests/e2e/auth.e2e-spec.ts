import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from '../../src/modules/sessions/entities/session.entity';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let sessionsRepository: Repository<Session>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get(DataSource);
    sessionsRepository = moduleFixture.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
  });

  beforeEach(async () => {
    await sessionsRepository
      .createQueryBuilder()
      .delete()
      .from(Session)
      .execute();
    // No borramos users/tenants/memberships porque el DemoSeedService
    // los deja listos para las pruebas.
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const login = async () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: '123456',
        tenantSlug: 'sentinel-labs',
      });
  };

  it('POST /api/auth/login -> devuelve access y refresh token', async () => {
    const response = await login();

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.accessTokenExpiresIn).toEqual(expect.any(Number));
    expect(response.body.refreshTokenExpiresIn).toEqual(expect.any(Number));
  });

  it('GET /api/auth/me -> devuelve perfil con bearer válido', async () => {
    const loginResponse = await login();
    const accessToken = loginResponse.body.accessToken as string;

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('admin@test.com');
    expect(response.body.tenant.slug).toBe('sentinel-labs');
    expect(response.body.roles).toContain('OWNER');
  });

  it('POST /api/auth/refresh -> rota refresh token', async () => {
    const loginResponse = await login();
    const refreshToken = loginResponse.body.refreshToken as string;

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).not.toBe(refreshToken);
  });

  it('POST /api/auth/refresh -> rechaza reuse del refresh viejo', async () => {
    const loginResponse = await login();
    const oldRefreshToken = loginResponse.body.refreshToken as string;

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshResponse.status).toBe(201);

    const reuseResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(reuseResponse.status).toBe(401);
  });

  it('POST /api/auth/logout -> invalida la sesión actual', async () => {
    const loginResponse = await login();
    const refreshToken = loginResponse.body.refreshToken as string;

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken });

    expect([200, 201, 204]).toContain(logoutResponse.status);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
  });

  it('POST /api/auth/logout-all -> invalida todas las sesiones del usuario', async () => {
    const login1 = await login();
    const login2 = await login();

    const accessToken = login1.body.accessToken as string;
    const refreshToken1 = login1.body.refreshToken as string;
    const refreshToken2 = login2.body.refreshToken as string;

    const logoutAllResponse = await request(app.getHttpServer())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([200, 201, 204]).toContain(logoutAllResponse.status);

    const refresh1 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshToken1 });

    const refresh2 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshToken2 });

    expect(refresh1.status).toBe(401);
    expect(refresh2.status).toBe(401);
  });

  it('POST /api/auth/login -> rechaza tenant inválido', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: '123456',
        tenantSlug: 'tenant-inexistente',
      });

    expect(response.status).toBe(401);
  });

  it('POST /api/auth/login -> rechaza password inválida', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'wrong-password',
        tenantSlug: 'sentinel-labs',
      });

    expect(response.status).toBe(401);
  });
});
