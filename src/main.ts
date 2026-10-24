import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Security headers (HSTS, X-Content-Type-Options, frameguard, etc.).
  app.use(helmet());

  // CORS for browser-based clients (e.g. consuming apps' web frontends).
  // Set AUTH_CORS_ORIGINS (comma-separated) to allowlist origins in production;
  // when unset the request origin is reflected, which is convenient for dev.
  const corsOrigins = process.env.AUTH_CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // Trust reverse proxies (docker network, gateway, cloudfront) so that
  // req.ip reflects the real client IP from X-Forwarded-For instead of
  // the immediate hop. Required for session anomaly detection to see
  // meaningful IPs, and for audit trails to record who did what.
  (
    app.getHttpAdapter().getInstance() as unknown as {
      set: (k: string, v: unknown) => void;
    }
  ).set('trust proxy', true);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  console.log(`Auth API running on http://localhost:${port}/api`);
}

void bootstrap();
