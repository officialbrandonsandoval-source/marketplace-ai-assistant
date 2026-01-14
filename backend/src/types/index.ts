import { z } from 'zod';

// Request context (attached by auth middleware)
export interface RequestContext {
  accountId: string;
  userId: string;
}

// Thread context from extension
export const ThreadContextSchema = z.object({
  threadId: z.string(),
  fbThreadId: z.string(),
  listingId: z.string().nullable().optional(),
  listingTitle: z.string().nullable(),
  listingPrice: z.string().nullable(),
  listingUrl: z.string().url().nullable(),
  conversationGoal: z.string().min(1).optional(),
  quickQuestion: z.string().min(1).optional(),
  customInstructions: z.string().min(1).optional(),
  savedPresetId: z.string().min(1).optional(),
  userInstructions: z.string().min(1).optional(),
  persistentContext: z.string().min(1).optional(),
  deviceFingerprint: z.string().min(10).optional(),
  userMessage: z.string().min(1).optional(),
  messages: z.array(
    z.object({
      senderId: z.string(),
      text: z.string(),
      timestamp: z.number(),
      isUser: z.boolean(),
    })
  ),
});

export type ThreadContext = z.infer<typeof ThreadContextSchema>;

// Suggestion response
export interface SuggestionResponse {
  suggestedMessage: string;
  intentScore: number;
  reasoning: string;
  nextAction: 'ask_availability' | 'send_booking_link' | 'answer_question' | 'close';
}

// Error response
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}
