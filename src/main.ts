import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';

import cookieParser from 'cookie-parser';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

   app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );


   // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('E-Commerce Backend API')
    .setDescription('NestJS E-Commerce REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup(
    'api',
    app,
    document,
  );

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
