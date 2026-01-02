type Message = {
  senderId: string;
  text: string;
  timestamp: number;
  isUser: boolean;
};

export function buildPrompt(input: {
  conversationGoal: string;
  messages: Message[];
  listingTitle?: string;
  listingPrice?: string;
  customInstructions?: string;
}) {
  const { conversationGoal, messages, customInstructions } = input;

  let systemInstruction = '';

  if (conversationGoal === 'sell_item') {
    systemInstruction = [
      'You are an assistant helping a seller close a sale.',
      'Your job is to guide the conversation toward commitment without being pushy.',
      'Ask one clear next-step question.',
      'Return ONLY valid JSON with keys: suggestedMessage, intentScore, reasoning, nextAction.',
      'intentScore must be a number between 0 and 1.',
      'nextAction must be one of: ask_availability, send_booking_link, answer_question, close.',
      'Do not add extra keys.',
      'No markdown. No extra keys. No preamble.',
    ].join(' ');
  } else {
    systemInstruction = [
      'You are a neutral conversation assistant.',
      'Do not assume a product, sale, or intent.',
      'Your job is to help the user clarify goals and move the conversation forward naturally.',
      'Return ONLY valid JSON with keys: suggestedMessage, intentScore, reasoning, nextAction.',
      'intentScore must be a number between 0 and 1.',
      'nextAction must be one of: ask_availability, send_booking_link, answer_question, close.',
      'Do not add extra keys.',
      'No markdown. No extra keys. No preamble.',
    ].join(' ');
  }

  if (customInstructions && customInstructions.trim().length > 0) {
    systemInstruction = `${systemInstruction} User instructions: ${customInstructions.trim()}`;
  }

  return {
    systemInstruction,
    messages,
  };
}
