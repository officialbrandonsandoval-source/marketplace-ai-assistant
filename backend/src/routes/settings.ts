import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { accountSettings } from '../db/schema.js';
import { getAccountPlan } from '../services/plan.js';

const SettingsSchema = z.object({
  globalInstructions: z.string().min(1).optional(),
  goalPresets: z.array(z.record(z.unknown())).optional(),
});

type AuthedRequest = FastifyRequest & {
  accountId?: string;
  userId?: string;
};

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/settings',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { accountId } = request as AuthedRequest;

      if (!accountId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing auth context',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      const { plan } = await getAccountPlan(accountId);

      // Block settings updates for free tier accounts.
      if (plan === 'free') {
        request.log.warn(
          { requestId: request.id, accountId, plan },
          'Plan upgrade required for settings'
        );
        return reply.code(403).send({
          error: 'PLAN_UPGRADE_REQUIRED',
          code: 'PLAN_UPGRADE_REQUIRED',
          message: 'Upgrade your plan to use settings.',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const payload = SettingsSchema.parse(request.body);
      const now = new Date();

      await db
        .insert(accountSettings)
        .values({
          account_id: accountId,
          global_instructions: payload.globalInstructions ?? null,
          goal_presets: payload.goalPresets ?? [],
          created_at: now,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: [accountSettings.account_id],
          set: {
            global_instructions: payload.globalInstructions ?? null,
            goal_presets: payload.goalPresets ?? [],
            updated_at: now,
          },
        });

      return reply.send({
        success: true,
        settings: {
          globalInstructions: payload.globalInstructions ?? null,
          goalPresets: payload.goalPresets ?? [],
        },
      });
    }
  );
}
