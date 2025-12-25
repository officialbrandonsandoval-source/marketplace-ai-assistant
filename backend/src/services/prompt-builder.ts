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
}) {
  const { conversationGoal, messages } = input;

  let systemInstruction = '';

  if (conversationGoal === 'sell_item') {
    systemInstruction = 'You are an assistant helping a seller close a sale. Your job is to guide the conversation toward commitment without being pushy. Ask one clear next-step question.';
  } else {
    systemInstruction = 'You are a neutral conversation assistant. Do not assume a product, sale, or intent. Your job is to help the user clarify goals and move the conversation forward naturally.';
  }

  return {
    systemInstruction,
    messages,
  };
}
