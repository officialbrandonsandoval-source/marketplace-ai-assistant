import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

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

redis.on('error', (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  // eslint-disable-next-line no-console
  console.log('Redis connected');
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Redis connection failed:', error);
    return false;
  }
}
