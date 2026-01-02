import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { redis } from '../redis/client.js';

export const CLAUDE_QUEUE_NAME = 'claude-suggestions';

export interface ClaudeJobPayload {
  accountId: string;
  userId: string;
  threadId: string;
  fbThreadId: string;
  listingTitle: string | null;
  listingPrice: string | null;
  listingUrl: string | null;
  conversationGoal: string;
  customInstructions?: string;
  savedPresetId?: string;
  messages: Array<{
    senderId: string;
    text: string;
    timestamp: number;
    isUser: boolean;
  }>;
  requestId: string;
}

const connection: Redis = redis.duplicate();

connection.on('error', (error: unknown) => {
  console.error('BullMQ Redis connection error:', error);
});

export const claudeQueue = new Queue<ClaudeJobPayload>(CLAUDE_QUEUE_NAME, {
  connection,
});
