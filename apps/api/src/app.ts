import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

/** Create an HTTP app without database connection or background timers for tests. */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet());
  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true,
    methods: ['GET', 'POST', 'PUT'], allowedHeaders: ['Content-Type', 'X-Mailora-Request'],
  });
  app.use(compression());
  morgan.token('safe-path', (req) => (req as any).path);
  app.use(morgan(':method :safe-path :status :response-time ms'));
  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  return app;
}
