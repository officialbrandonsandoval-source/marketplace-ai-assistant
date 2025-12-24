import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ThreadContextSchema, type SuggestionResponse } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { db } from '../db/client.js';
import { threads, actions } from '../db/schema.js';

type AuthedRequest = {
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
      try {
        const accountId = (request as unknown as AuthedRequest).accountId;
        const userId = (request as unknown as AuthedRequest).userId;

        if (!accountId || !userId) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Missing auth context',
            statusCode: 401,
            timestamp: new Date().toISOString(),
          });
        }

        const context = ThreadContextSchema.parse(request.body);

        // Store/update thread (multi-tenant unique by account_id + fb_thread_id)
        await db
          .insert(threads)
          .values({
            account_id: accountId,
            user_id: userId,
            fb_thread_id: context.fbThreadId,
            listing_data: {
              id: context.listingId,
              title: context.listingTitle,
              price: context.listingPrice,
              url: context.listingUrl,
            },
          })
          .onConflictDoUpdate({
            target: [threads.account_id, threads.fb_thread_id],
            set: {
              listing_data: {
                id: context.listingId,
                title: context.listingTitle,
                price: context.listingPrice,
                url: context.listingUrl,
              },
              updated_at: new Date(),
            },
          });

        // Log action
        await db.insert(actions).values({
          account_id: accountId,
          user_id: userId,
          action_type: 'suggestion_requested',
          metadata: {
            thread_id: context.threadId,
            fb_thread_id: context.fbThreadId,
            message_count: context.messages.length,
          },
          ip_address: request.ip,
          user_agent: request.headers['user-agent'] ?? null,
        });

        // STUB RESPONSE (Phase 4 will call Claude)
        const response: SuggestionResponse = {
          suggestedMessage: 'Phase 3 stub: Backend connected successfully!',
          intentScore: 0.5,
          reasoning: 'Claude integration will be added in Phase 4',
          nextAction: 'ask_availability',
        };

        request.log.info({ accountId, threadId: context.threadId }, 'Suggestion requested (stub)');

        return reply.send(response);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'Validation error',
            message: error.issues[0]?.message ?? 'Invalid request',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }
        throw error;
      }
    }
  );
}
