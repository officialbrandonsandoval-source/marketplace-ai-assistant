import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const PlanSchema = z.object({
  accountId: z.string().uuid(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  planExpiresAt: z.string().datetime().nullable().optional(),
});

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/admin/plan',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const adminKey = process.env.ADMIN_API_KEY;
      const requestId = request.id;

      if (!adminKey) {
        request.log.error({ requestId }, 'ADMIN_API_KEY missing');
        return reply.code(500).send({
          error: 'ADMIN_NOT_CONFIGURED',
          code: 'ADMIN_NOT_CONFIGURED',
          message: 'Admin access is not configured.',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }

      const providedKey = request.headers['x-admin-key'];
      if (providedKey !== adminKey) {
        request.log.warn({ requestId }, 'Admin key rejected');
        return reply.code(403).send({
          error: 'ADMIN_UNAUTHORIZED',
          code: 'ADMIN_UNAUTHORIZED',
          message: 'Admin access denied.',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const payload = PlanSchema.parse(request.body);
      const expiresAt = payload.planExpiresAt ? new Date(payload.planExpiresAt) : null;

      await db
        .update(accounts)
        .set({
          plan: payload.plan,
          plan_tier: payload.plan,
          plan_expires_at: expiresAt,
          updated_at: new Date(),
        })
        .where(eq(accounts.id, payload.accountId));

      request.log.info(
        { requestId, accountId: payload.accountId, plan: payload.plan },
        'Account plan updated'
      );

      return reply.send({
        success: true,
        accountId: payload.accountId,
        plan: payload.plan,
        planExpiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
    }
  );
}
