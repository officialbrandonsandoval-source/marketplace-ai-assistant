import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { OriginFunction } from '@fastify/cors';
import * as dotenv from 'dotenv';
import { authRoutes } from './routes/auth.js';
import { suggestRoutes } from './routes/suggest.js';
import { settingsRoutes } from './routes/settings.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { checkDatabaseConnection } from './db/client.js';
import { checkRedisConnection } from './redis/client.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [];

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

fastify.addHook('onRequest', async (request) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      requestId: request.id,
      ip: request.ip,
    },
    'Incoming request'
  );
});

// CORS
const corsOrigin: OriginFunction = (origin, callback) => {
  if (!origin) return callback(null, true);

  // Allow browser extension origins (Chrome/Firefox) since the client is a packaged extension,
  // not a traditional website origin.
  if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
    return callback(null, true);
  }

  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'), false);
  }
};

await fastify.register(cors, {
  origin: corsOrigin,
  credentials: true,
});

// Error handler
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => {
  const dbOk = await checkDatabaseConnection();
  const redisOk = await checkRedisConnection();

  const healthy = dbOk && redisOk;

  return {
    status: healthy ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };
});

// Routes
await fastify.register(authRoutes);
await fastify.register(suggestRoutes);
await fastify.register(settingsRoutes);
await fastify.register(adminRoutes);

// Start the queue worker in-process by default.
// This avoids suggestion jobs getting stuck in `pending` when no separate worker service is running.
// Disable by setting START_WORKER=false.
if (process.env.START_WORKER !== 'false') {
  try {
    await import('./worker.js');
    fastify.log.info('Background worker started in-process');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to start background worker');
  }
}

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info({ host: HOST, port: PORT }, 'Server listening');
} catch (error) {
  fastify.log.error({ error }, 'Failed to start server');
  process.exit(1);
}
