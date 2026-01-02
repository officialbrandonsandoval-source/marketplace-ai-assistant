import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { db } from './db/client.js';
import { actions } from './db/schema.js';
import { callClaude } from './clients/claude-client.js';
import { parseClaudeResponse } from './services/response-parser.js';
import { buildPrompt } from './services/prompt-builder.js';
import { assertCircuitClosed, recordFailure, recordSuccess } from './services/circuit-breaker.js';
import {
  setSuggestionResult,
  type SuggestionJobResult,
} from './services/suggestion-results.js';
import { CLAUDE_QUEUE_NAME, type ClaudeJobPayload } from './queue/claude-queue.js';
import { redis } from './redis/client.js';

const connection: Redis = redis.duplicate();

connection.on('error', (error: unknown) => {
  console.error('Worker Redis connection error:', error);
});

function buildTranscript(messages: ClaudeJobPayload['messages']): string {
  const transcript = messages
    .map((message) => `${message.isUser ? 'User' : 'Other'}: ${message.text}`)
    .join('\n');
  return transcript.length > 0 ? transcript : 'No messages yet.';
}

async function storeResult(accountId: string, jobId: string, result: SuggestionJobResult): Promise<void> {
  await setSuggestionResult(accountId, jobId, result);
}

const worker = new Worker<ClaudeJobPayload>(
  CLAUDE_QUEUE_NAME,
  async (job) => {
    const { accountId, userId } = job.data;
    const jobId = String(job.id ?? '');
    const startedAt = Date.now();

    await storeResult(accountId, jobId, {
      jobId,
      status: 'processing',
      suggestion: null,
      error: null,
      updatedAt: new Date().toISOString(),
    });

    try {
      await assertCircuitClosed();

      const prompt = buildPrompt({
        conversationGoal: job.data.conversationGoal,
        messages: job.data.messages,
        listingTitle: job.data.listingTitle ?? undefined,
        listingPrice: job.data.listingPrice ?? undefined,
        customInstructions: job.data.customInstructions ?? undefined,
      });

      const transcript = buildTranscript(job.data.messages);

      const claudeResponse = await callClaude({
        system: prompt.systemInstruction,
        userMessage: transcript,
        maxTokens: 300,
        temperature: 0,
      });

      const suggestion = parseClaudeResponse(
        claudeResponse.content,
        job.data.conversationGoal
      );

      await recordSuccess();

      await storeResult(accountId, jobId, {
        jobId,
        status: 'completed',
        suggestion,
        error: null,
        updatedAt: new Date().toISOString(),
      });

      await db.insert(actions).values({
        account_id: accountId,
        user_id: userId,
        action_type: 'suggestion_generated',
        metadata: {
          thread_id: job.data.threadId,
          message_count: job.data.messages.length,
          intent_score: suggestion.intentScore,
          next_action: suggestion.nextAction,
          tokens_used: claudeResponse.usage.totalTokens,
          input_tokens: claudeResponse.usage.inputTokens,
          output_tokens: claudeResponse.usage.outputTokens,
          duration_ms: Date.now() - startedAt,
          prompt_length: prompt.systemInstruction.length + transcript.length,
        },
        ip_address: null,
        user_agent: null,
      });

      return suggestion;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Suggestion generation failed';

      await recordFailure();

      await storeResult(accountId, jobId, {
        jobId,
        status: 'failed',
        suggestion: null,
        error: message === 'CLAUDE_CIRCUIT_OPEN'
          ? 'Claude temporarily unavailable. Please retry shortly.'
          : message,
        updatedAt: new Date().toISOString(),
      });

      await db.insert(actions).values({
        account_id: accountId,
        user_id: userId,
        action_type: 'error',
        metadata: {
          error_type: 'suggestion_generation_failed',
          error_message: message,
          duration_ms: Date.now() - startedAt,
        },
        ip_address: null,
        user_agent: null,
      });

      throw error;
    }
  },
  {
    connection,
  }
);

worker.on('failed', (job, error) => {
  console.error('Suggestion job failed', {
    jobId: job?.id,
    error: error instanceof Error ? error.message : String(error),
  });
});

worker.on('completed', (job) => {
  console.info('Suggestion job completed', { jobId: job.id });
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
