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
  quickQuestion?: string;
  persistentContext?: string;
  customInstructions?: string;
}) {
  const { conversationGoal, messages, customInstructions, quickQuestion, persistentContext } = input;

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
  } else if (conversationGoal === 'buy_item') {
    systemInstruction = [
      'You are an assistant helping a buyer purchase an item.',
      'Be clear and concise. Ask one helpful next-step question if needed.',
      'Return ONLY valid JSON with keys: suggestedMessage, intentScore, reasoning, nextAction.',
      'intentScore must be a number between 0 and 1.',
      'nextAction must be one of: ask_availability, send_booking_link, answer_question, close.',
      'Do not add extra keys.',
      'No markdown. No extra keys. No preamble.',
    ].join(' ');
  } else if (conversationGoal === 'negotiate_price') {
    systemInstruction = [
      'You are an assistant helping negotiate price politely and efficiently.',
      'Be respectful. Keep it short. Ask for confirmation or propose a concrete number.',
      'Return ONLY valid JSON with keys: suggestedMessage, intentScore, reasoning, nextAction.',
      'intentScore must be a number between 0 and 1.',
      'nextAction must be one of: ask_availability, send_booking_link, answer_question, close.',
      'Do not add extra keys.',
      'No markdown. No extra keys. No preamble.',
    ].join(' ');
  } else if (conversationGoal === 'arrange_pickup') {
    systemInstruction = [
      'You are an assistant helping finalize logistics for pickup/meetup.',
      'Propose a specific time window and confirm location.',
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

  if (quickQuestion && quickQuestion.trim().length > 0) {
    systemInstruction = `${systemInstruction} The user selected a simple question to cover: ${quickQuestion.trim()}.`;
  }

  if (persistentContext && persistentContext.trim().length > 0) {
    systemInstruction = `${systemInstruction} User profile/context:\n${persistentContext.trim()}`;
  }

  if (customInstructions && customInstructions.trim().length > 0) {
    systemInstruction = `${systemInstruction} User instructions: ${customInstructions.trim()}`;
  }

  return {
    systemInstruction,
    messages,
  };
}
