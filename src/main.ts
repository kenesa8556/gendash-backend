import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableShutdownHooks();
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-org-id'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();