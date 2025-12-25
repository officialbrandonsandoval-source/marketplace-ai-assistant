import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

if (!CLAUDE_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY missing');
}

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

export interface ClaudeRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ClaudeResponse {
  content: string;
  usage: ClaudeUsage;
}

export async function callClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
  try {
    console.info('[Claude] Request', {
      model: CLAUDE_MODEL,
      maxTokens: request.maxTokens || 300,
      promptLength: request.prompt.length,
    });

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: request.maxTokens || 300,
      temperature: request.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');

    if (!textContent || textContent.type !== 'text') {
      throw new Error('Claude returned non-text response');
    }

    return {
      content: textContent.text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error('[Claude] API call failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Claude API call failed');
  }
}
