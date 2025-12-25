import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required');
}

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
};

export const redis = new Redis(redisUrl, redisOptions);

redis.on('connect', () => {
  console.info('Redis connected');
});

redis.on('error', (error: unknown) => {
  console.error('Redis connection error:', error);
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  try {
    await redis.quit();
  } catch (error) {
    console.error('Redis close failed:', error);
    redis.disconnect();
  }
}
