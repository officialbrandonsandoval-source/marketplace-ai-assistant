import type { ThreadContext } from '../types/index.js';

export function buildClaudePrompt(context: ThreadContext): string {
  const listing = context.listingTitle || 'Unknown Item';
  const price = context.listingPrice || 'Price not specified';

  const conversationHistory = context.messages
    .map((msg) => {
      const sender = msg.isUser ? 'You (Seller)' : 'Buyer';
      return `${sender}: ${msg.text}`;
    })
    .join('\n');

  const prompt = `You are a professional automotive sales assistant on Facebook Marketplace.

LISTING DETAILS:
- Title: ${listing}
- Price: ${price}
- URL: ${context.listingUrl || 'Not provided'}

CONVERSATION HISTORY:
${conversationHistory || 'No messages yet'}

YOUR TASK:
Generate the BEST next reply to move this conversation toward booking an in-person test drive or showing.

RESPONSE REQUIREMENTS:
1. Be friendly, professional, and natural
2. Keep the reply under 200 characters
3. Ask ONLY ONE question or make ONE point
4. Match the buyer's communication style (casual/formal)
5. Do NOT mention that you are an AI
6. Do NOT use overly salesy language
7. Focus on building trust and scheduling a meeting

INTENT SCORING GUIDE:
- 0.9-1.0: Buyer explicitly asked about availability or wants to meet
- 0.7-0.9: Buyer asked detailed questions, shows strong interest
- 0.5-0.7: Buyer responded positively but hasn't committed
- 0.3-0.5: Buyer asked basic questions, lukewarm interest
- 0.0-0.3: Low engagement or likely not serious

NEXT ACTION GUIDE:
- "ask_availability": Buyer seems interested, ask when they can meet
- "send_booking_link": Buyer wants to schedule, offer specific times
- "answer_question": Buyer asked a question, answer it first
- "close": Buyer is not interested or conversation is going nowhere

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
{
  "suggestedMessage": "Your reply here (max 200 chars)",
  "intentScore": 0.85,
  "reasoning": "Brief explanation of why you chose this approach",
  "nextAction": "ask_availability"
}

Return ONLY valid JSON with keys suggestedMessage, intentScore, reasoning, nextAction.
No preamble. No markdown code blocks. Just the JSON object.`;

  console.info('[Claude] Prompt', {
    preview: prompt.slice(0, 1000),
    length: prompt.length,
  });

  return prompt;
}
