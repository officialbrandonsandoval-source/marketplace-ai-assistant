import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis/client.js';
import { getAccountPlan } from '../services/plan.js';

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
    // Resolve plan server-side to enforce paid-tier rate limits.
    const { plan } = await getAccountPlan(accountId);
    const limit = LIMITS[plan];
    const dateKey = new Date().toISOString().slice(0, 10);
    const key = `rate_limit:${accountId}:${dateKey}`;

    const count = await redis.incr(key);

    let resetAt = 0;
    if (count === 1) {
      const now = new Date();
      const endOfDayUtc = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      ));
      const ttlSeconds = Math.max(1, Math.floor((endOfDayUtc.getTime() - now.getTime()) / 1000));
      await redis.expire(key, ttlSeconds);
      resetAt = endOfDayUtc.getTime();
    } else {
      const ttlSeconds = await redis.ttl(key);
      if (ttlSeconds > 0) {
        resetAt = Date.now() + ttlSeconds * 1000;
      }
    }

    if (count > limit) {
      request.log.warn(
        { requestId: request.id, accountId, plan, count, limit },
        'Rate limit exceeded'
      );
      return void reply.code(429).send({
        error: 'RATE_LIMIT_EXCEEDED',
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Daily limit of ${limit} requests exceeded. Please try again tomorrow or upgrade your plan.`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
      });
    }

    reply.header('X-RateLimit-Limit', limit.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - count).toString());
    if (resetAt > 0) {
      reply.header('X-RateLimit-Reset', resetAt.toString());
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      request.log.warn({ requestId: request.id, accountId }, 'Account not found during rate limit');
      return void reply.code(404).send({
        error: 'Not Found',
        message: 'Account not found',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

    request.log.error({ error, accountId, requestId: request.id }, 'Rate limit check failed');
    // Fail open if Redis/DB issue
  }
}
