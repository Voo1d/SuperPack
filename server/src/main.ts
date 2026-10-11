import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import { loadConfig } from './config';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config));
  configureApp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`SuperPack слушает 0.0.0.0:${config.port}${config.devAuth ? ' (DEV_AUTH включён)' : ''}`);
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
