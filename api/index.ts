import 'tsconfig-paths/register';
import type { Request, Response } from 'express';

let cachedHandler: ((req: Request, res: Response) => void) | null = null;

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const { createApp } = await import('../src/app.bootstrap');
  const app = await createApp();
  await app.init();

  const expressInstance = app.getHttpAdapter().getInstance();
  cachedHandler = expressInstance as (req: Request, res: Response) => void;

  return cachedHandler;
}

export default async function handler(req: Request, res: Response) {
  const nestHandler = await getHandler();
  return nestHandler(req, res);
}
