import type { SuggestionResponse } from '../types/index.js';

const allowedNextActions = ['ask_availability', 'send_booking_link', 'answer_question', 'close'] as const;

type AllowedNextAction = (typeof allowedNextActions)[number];

export function isSuggestionResponse(value: unknown): value is SuggestionResponse {
  if (!isRecord(value)) {
    return false;
  }

  const suggestedMessage = value.suggestedMessage;
  const intentScore = value.intentScore;
  const reasoning = value.reasoning;
  const nextAction = value.nextAction;

  return (
    typeof suggestedMessage === 'string' &&
    suggestedMessage.length > 0 &&
    typeof intentScore === 'number' &&
    intentScore >= 0 &&
    intentScore <= 1 &&
    typeof reasoning === 'string' &&
    reasoning.length > 0 &&
    typeof nextAction === 'string' &&
    allowedNextActions.includes(nextAction as AllowedNextAction)
  );
}

const forbiddenPatterns = [
  /system prompt/i,
  /system message/i,
  /developer message/i,
  /developer instructions?/i,
  /as an ai/i,
  /i am an ai/i,
  /i'm an ai/i,
  /language model/i,
];

export function parseClaudeResponse(rawText: string, conversationGoal: string): SuggestionResponse {
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed';
    throw new Error(`Claude returned invalid JSON: ${message}. Raw response: ${cleaned}`);
  }

  if (!isSuggestionResponse(parsed)) {
    throw new Error('Claude response does not match SuggestionResponse schema');
  }

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(parsed.suggestedMessage) || pattern.test(parsed.reasoning)) {
      throw new Error('Claude response contained disallowed meta content');
    }
  }

  if (
    conversationGoal !== 'sell_item' &&
    /vehicle|test drive|inventory/i.test(parsed.suggestedMessage)
  ) {
    throw new Error('Car language leaked into non-sell flow');
  }

  return {
    suggestedMessage: parsed.suggestedMessage.trim().slice(0, 200),
    intentScore: Math.min(1, Math.max(0, parsed.intentScore)),
    reasoning: parsed.reasoning.trim(),
    nextAction: parsed.nextAction,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
