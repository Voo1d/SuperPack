import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppConfig } from './config';

/** Общая настройка приложения для main.ts и тестов: префикс /api и раздача собранного React с того же origin. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.disable('x-powered-by');

  const webDist = config.webDist ?? path.resolve(__dirname, '../../web/dist');
  const indexHtml = path.join(webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
    app.use((req: Request, res: Response, next: NextFunction) => {
      const isApi = req.path === '/health' || req.path === '/api' || req.path.startsWith('/api/');
      if (req.method !== 'GET' || isApi || path.extname(req.path)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }
}
