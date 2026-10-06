import { createApp } from './app';
const { app } = await createApp({ logger: true });
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: 'localhost' });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
