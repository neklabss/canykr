import { loadEnv } from './config/env';
import { createApp } from './app.factory';

async function bootstrap() {
  const env = loadEnv();
  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
