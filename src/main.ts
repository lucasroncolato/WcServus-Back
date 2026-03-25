import { ConfigService } from '@nestjs/config';
import { createApp } from './app.bootstrap';

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
