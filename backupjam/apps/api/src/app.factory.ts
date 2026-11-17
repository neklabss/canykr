import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { Env } from './config/env';
import { HttpExceptionFilter } from './common/http-exception.filter';


export function configureApp(app: NestExpressApplication, env: Env): void {
  app.useLogger(app.get(Logger));
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false }));
  app.useBodyParser('json', { limit: '256kb' });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: false, allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language', 'X-BUJ-Locale', 'X-Request-Id', 'Idempotency-Key'], exposedHeaders: ['X-Request-Id', 'ETag'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: false }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('BackUpJam API')
    .setDescription('BackUpJam backend API. Errors use { error: { code, message, details? }, requestId }. Messages are localized via Accept-Language / X-BUJ-Locale / account preference.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

export async function createApp(env: Env, mutate?: (builder: ReturnType<typeof AppModule.register>) => void): Promise<NestExpressApplication> {
  const mod = AppModule.register(env);
  mutate?.(mod);
  const app = await NestFactory.create<NestExpressApplication>(mod, { bufferLogs: true, bodyParser: false });
  configureApp(app, env);
  if (env.NODE_ENV !== 'production') SwaggerModule.setup('api/docs', app, buildOpenApi(app));
  return app;
}
