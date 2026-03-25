import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createApp } from './app.bootstrap';

async function bootstrap() {
  // Keep a direct Nest import in this entrypoint so Vercel's Nest detector
  // can identify the project correctly during build.
  void NestFactory;
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
