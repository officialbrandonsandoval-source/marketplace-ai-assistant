import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ThreadContextSchema } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { db } from '../db/client.js';
import { threads, actions } from '../db/schema.js';
import { getAccountPlan } from '../services/plan.js';
import { claudeQueue } from '../queue/claude-queue.js';
import {
  setSuggestionResult,
  getSuggestionResult,
  type SuggestionJobResult,
} from '../services/suggestion-results.js';

type AuthedRequest = FastifyRequest & {
  accountId?: string;
  userId?: string;
};

export async function suggestRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/suggest',
    {
      preHandler: [authMiddleware, rateLimitMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      const { accountId, userId } = request as AuthedRequest;

      if (!accountId || !userId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing auth context',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const context = ThreadContextSchema.parse(request.body);

        await db
          .insert(threads)
          .values({
            account_id: accountId,
            user_id: userId,
            fb_thread_id: context.fbThreadId,
            listing_data: {
              title: context.listingTitle,
              price: context.listingPrice,
              url: context.listingUrl,
            },
          })
          .onConflictDoUpdate({
            target: [threads.account_id, threads.fb_thread_id],
            set: {
              listing_data: {
                title: context.listingTitle,
                price: context.listingPrice,
                url: context.listingUrl,
              },
              updated_at: new Date(),
            },
          });

        const body = request.body as {
          conversationGoal?: string;
          customInstructions?: string;
          savedPresetId?: string;
        };
        const conversationGoal = body.conversationGoal ?? 'general_assistance';
        const { plan } = await getAccountPlan(accountId);

        // Enforce paid-tier features on the server to prevent bypassing via extension.
        if (plan === 'free' && (body.customInstructions || body.savedPresetId)) {
          request.log.warn(
            { requestId: request.id, accountId, plan },
            'Plan upgrade required for advanced settings'
          );
          return reply.code(403).send({
            error: 'PLAN_UPGRADE_REQUIRED',
            code: 'PLAN_UPGRADE_REQUIRED',
            message: 'Upgrade your plan to use custom instructions or presets.',
            statusCode: 403,
            timestamp: new Date().toISOString(),
          });
        }

        await db.insert(actions).values({
          account_id: accountId,
          user_id: userId,
          action_type: 'suggestion_requested',
          metadata: {
            thread_id: context.threadId,
            message_count: context.messages.length,
            conversation_goal: conversationGoal,
          },
          ip_address: request.ip,
          user_agent: request.headers['user-agent'] ?? null,
        });

        const job = await claudeQueue.add('generate', {
          accountId,
          userId,
          threadId: context.threadId,
          fbThreadId: context.fbThreadId,
          listingTitle: context.listingTitle,
          listingPrice: context.listingPrice,
          listingUrl: context.listingUrl,
          conversationGoal,
          customInstructions: body.customInstructions,
          savedPresetId: body.savedPresetId,
          messages: context.messages,
          requestId: request.id,
        });

        const jobId = String(job.id ?? '');
        const pending: SuggestionJobResult = {
          jobId,
          status: 'pending',
          suggestion: null,
          error: null,
          updatedAt: new Date().toISOString(),
        };

        await setSuggestionResult(accountId, jobId, pending);

        request.log.info(
          {
            accountId,
            threadId: context.threadId,
            jobId,
            durationMs: Date.now() - startTime,
          },
          'Suggestion job queued'
        );

        return reply.send(pending);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : undefined;

        try {
          await db.insert(actions).values({
            account_id: accountId,
            user_id: userId,
            action_type: 'error',
            metadata: {
              error_type: 'suggestion_generation_failed',
              error_message: errorMessage,
              duration_ms: Date.now() - startTime,
            },
            ip_address: request.ip,
            user_agent: request.headers['user-agent'] ?? null,
          });
        } catch (dbError) {
          request.log.error({ error: dbError }, 'Failed to log error action');
        }

        request.log.error(
          {
            error: errorMessage,
            stack,
            accountId,
            threadId: (request.body as { threadId?: string } | null)?.threadId,
            durationMs: Date.now() - startTime,
          },
          'Suggestion generation failed'
        );

        if (error instanceof z.ZodError) {
          const issue = error.issues[0];
          const field = issue?.path.join('.') || 'body';
          const message = issue ? `${field}: ${issue.message}` : 'Invalid request';
          return reply.code(400).send({
            error: 'Validation error',
            message,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(500).send({
          error: 'Suggestion generation failed',
          message: errorMessage,
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  fastify.get(
    '/suggest/:jobId',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { accountId } = request as AuthedRequest;
      const params = request.params as { jobId?: string };
      const jobId = typeof params.jobId === 'string' ? params.jobId : '';

      if (!accountId) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing auth context',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      if (!jobId) {
        return reply.code(400).send({
          error: 'Validation error',
          message: 'jobId is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await getSuggestionResult(accountId, jobId);

      if (!result) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Suggestion job not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send(result);
    }
  );
}
