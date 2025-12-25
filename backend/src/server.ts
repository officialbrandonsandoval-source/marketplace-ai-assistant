import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { OriginFunction } from '@fastify/cors';
import * as dotenv from 'dotenv';
import { authRoutes } from './routes/auth.js';
import { suggestRoutes } from './routes/suggest.js';
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

// CORS
const corsOrigin: OriginFunction = (origin, callback) => {
  if (!origin) return callback(null, true);

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

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info({ host: HOST, port: PORT }, 'Server listening');
} catch (error) {
  fastify.log.error({ error }, 'Failed to start server');
  process.exit(1);
}
