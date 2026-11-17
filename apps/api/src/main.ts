import 'dotenv/config';
import { createApp } from './app.js';
import { DatabaseService } from './database/database.service.js';
import { WorkersService } from './mail/workers.service.js';

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.get(DatabaseService).connect();
  app.get(WorkersService).start();
  const port = Number(process.env.PORT || 8000);
  await app.listen(port);
  console.log(`Mailora API listening on ${port}`);
}

bootstrap().catch((error) => {
  console.error('API startup failed:', error);
  process.exitCode = 1;
});
