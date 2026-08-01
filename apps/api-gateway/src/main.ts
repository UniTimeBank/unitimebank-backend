import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Unitimebank API Documentation')
    .setDescription('Hệ thống API Microservices - Unitimebank')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Unitimebank API Docs',
    customCss: `
      .swagger-ui .info .title { font-size: 32px }
      .swagger-ui .opblock-tag { font-size: 16px; font-weight: bold }
    `,
  });

  await app.listen(parseInt(process.env.PORT || '3000', 10));
  console.log('API Gateway running on port 3000');
  console.log('Swagger: http://localhost:3000/api/docs');
}
bootstrap();
