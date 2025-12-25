import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis/client.js';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const LIMITS = {
  free: parseInt(process.env.RATE_LIMIT_FREE_DAILY || '15', 10),
  pro: parseInt(process.env.RATE_LIMIT_PRO_DAILY || '100', 10),
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE_DAILY || '1000', 10),
} as const;

type AuthedRequest = FastifyRequest & {
  accountId?: string;
};

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const accountId = (request as AuthedRequest).accountId;

  if (!accountId) {
    return void reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing account context',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return void reply.code(404).send({
        error: 'Not Found',
        message: 'Account not found',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

  const planTier = account.plan_tier as keyof typeof LIMITS;
  const limit = LIMITS[planTier];
    const key = `rate-limit:${accountId}:daily`;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 86400);
    }

    if (count > limit) {
      return void reply.code(429).send({
        error: 'Rate limit exceeded',
        message: `Daily limit of ${limit} requests exceeded`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
      });
    }

    reply.header('X-RateLimit-Limit', limit.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - count).toString());

  } catch (error) {
    request.log.error({ error, accountId }, 'Rate limit check failed');
    // Fail open if Redis/DB issue
  }
}
