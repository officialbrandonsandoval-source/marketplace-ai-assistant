import type { ThreadContext, SuggestionResponse } from '../types/index.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-3-5-sonnet-20240620';

type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ClaudeResponse = {
  content: Array<{ type: 'text'; text: string }>;
};

type SuggestionAction = SuggestionResponse['nextAction'];

const validNextActions: SuggestionAction[] = [
  'ask_availability',
  'send_booking_link',
  'answer_question',
  'close',
];

export async function generateSuggestion(context: ThreadContext): Promise<SuggestionResponse> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const systemPrompt =
    'You are an assistant that drafts helpful, concise replies for a Facebook Marketplace seller. ' +
    'Return only valid JSON with keys: suggestedMessage (string), intentScore (number 0-1), ' +
    'reasoning (string), nextAction (one of ask_availability, send_booking_link, answer_question, close).';

  const userPayload = {
    listing: {
      id: context.listingId,
      title: context.listingTitle,
      price: context.listingPrice,
      url: context.listingUrl,
    },
    threadId: context.threadId,
    fbThreadId: context.fbThreadId,
    messages: context.messages.map((message) => ({
      sender: message.isUser ? 'seller' : 'buyer',
      text: message.text,
      timestamp: message.timestamp,
    })),
  };

  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: JSON.stringify(userPayload),
    },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Claude API error: ${response.status}`;
    try {
      const errorData = (await response.json()) as { error?: { message?: string } };
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Ignore JSON parse failures for non-JSON responses
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as ClaudeResponse;
  const text = data.content?.[0]?.text ?? '';
  const parsed = parseJsonObject(text);

  if (!isSuggestionResponse(parsed)) {
    throw new Error('Claude response was not a valid suggestion payload');
  }

  return {
    suggestedMessage: parsed.suggestedMessage.trim(),
    intentScore: clamp01(parsed.intentScore),
    reasoning: parsed.reasoning.trim(),
    nextAction: parsed.nextAction,
  };
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('Claude response did not include JSON');
  }

  const json = text.slice(start, end + 1);
  return JSON.parse(json);
}

function isSuggestionResponse(value: unknown): value is SuggestionResponse {
  if (!isRecord(value)) return false;
  if (typeof value.suggestedMessage !== 'string') return false;
  if (typeof value.intentScore !== 'number') return false;
  if (typeof value.reasoning !== 'string') return false;
  if (!validNextActions.includes(value.nextAction as SuggestionAction)) return false;
  return true;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
