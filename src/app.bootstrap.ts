import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function buildCorsOptions(frontendUrl: string | undefined): CorsOptions {
  const rawOrigins = (frontendUrl ?? '*')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (rawOrigins.length === 0 || rawOrigins.includes('*')) {
    return {
      origin: true,
      credentials: true,
    };
  }

  const allowedOrigins = new Set(rawOrigins);

  return {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      callback(null, allowedOrigins.has(normalized));
    },
  };
}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors(buildCorsOptions(configService.get<string>('FRONTEND_URL')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: errors.map((error) => ({
            property: error.property,
            constraints: error.constraints,
          })),
        }),
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema de Servos API')
    .setDescription('API para gestao de servos e operacao ministerial')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  return app;
}
