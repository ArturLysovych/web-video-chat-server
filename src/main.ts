import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { initializeSockets } from './socket/socket.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  const server = app.getHttpServer();

  initializeSockets(server);

  await app.listen(3000);
}

bootstrap();
