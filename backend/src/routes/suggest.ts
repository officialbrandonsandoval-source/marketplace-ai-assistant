import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ThreadContextSchema, type SuggestionResponse } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { db } from '../db/client.js';
import { threads, actions } from '../db/schema.js';
import { buildClaudePrompt } from '../services/prompt-builder.js';
import { callClaude } from '../clients/claude-client.js';
import { parseClaudeResponse } from '../services/response-parser.js';

type AuthedRequest = FastifyRequest & {
  accountId?: string;
  userId?: string;
};

function logClaudeError(error: unknown): void {
  const err = error instanceof Error ? error : null;
  console.error('[Claude] Error', {
    name: err?.name ?? 'UnknownError',
    message: err?.message ?? String(error),
    stack: err?.stack,
    cause: err && 'cause' in err ? (err as { cause?: unknown }).cause : undefined,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createBadGatewayError(fastify: FastifyInstance, message: string): Error {
  const instance = fastify as FastifyInstance & {
    httpErrors?: { badGateway: (msg: string) => Error };
  };

  if (instance.httpErrors?.badGateway) {
    return instance.httpErrors.badGateway(message);
  }

  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 502;
  return error;
}

function isHttpError(error: unknown): error is { statusCode: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

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

        const prompt = buildClaudePrompt(context);

        request.log.info(
          {
            accountId,
            threadId: context.threadId,
            messageCount: context.messages.length,
            promptLength: prompt.length,
          },
          'Calling Claude API'
        );

        let claudeResponse;
        try {
          claudeResponse = await callClaude({
            prompt,
            maxTokens: 300,
            temperature: 0.7,
          });
        } catch (error) {
          logClaudeError(error);
          throw createBadGatewayError(fastify, getErrorMessage(error));
        }

        let suggestion: SuggestionResponse;
        try {
          suggestion = parseClaudeResponse(claudeResponse.content);
        } catch (error) {
          logClaudeError(error);
          throw createBadGatewayError(fastify, getErrorMessage(error));
        }

        await db.insert(actions).values({
          account_id: accountId,
          user_id: userId,
          action_type: 'suggestion_generated',
          metadata: {
            thread_id: context.threadId,
            message_count: context.messages.length,
            intent_score: suggestion.intentScore,
            next_action: suggestion.nextAction,
            tokens_used: claudeResponse.usage.totalTokens,
            input_tokens: claudeResponse.usage.inputTokens,
            output_tokens: claudeResponse.usage.outputTokens,
            duration_ms: Date.now() - startTime,
            prompt_length: prompt.length,
          },
          ip_address: request.ip,
          user_agent: request.headers['user-agent'] ?? null,
        });

        request.log.info(
          {
            accountId,
            threadId: context.threadId,
            inputTokens: claudeResponse.usage.inputTokens,
            outputTokens: claudeResponse.usage.outputTokens,
            totalTokens: claudeResponse.usage.totalTokens,
            intentScore: suggestion.intentScore,
            nextAction: suggestion.nextAction,
            durationMs: Date.now() - startTime,
          },
          'Claude API call successful'
        );

        return reply.send(suggestion);
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

        if (isHttpError(error) && error.statusCode === 502) {
          return reply.code(502).send({
            error: 'Claude error',
            message: error.message,
            statusCode: 502,
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
}
