import axios from 'axios';

/**
 * Anthropic API Adapter
 */
export const anthropicAdapter = {
  async chatCompletion({
    apiKey,
    baseURL = 'https://api.anthropic.com/v1',
    model,
    messages,
    temperature = 0.7,
    maxTokens = 1000,
    stream = false,
  }) {
    // Convert OpenAI format messages to Anthropic format if needed
    // Simple conversion: Filter out system messages to top level
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const config = {
      method: 'post',
      url: `${baseURL.replace(/\/+$/, '')}/messages`,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      data: {
        model,
        messages: userMessages,
        system: systemMessage,
        max_tokens: maxTokens,
        temperature,
        stream,
      },
      responseType: stream ? 'stream' : 'json',
    };

    return axios(config);
  },
  
  // Anthropic supports vision in the same endpoint
  async visionCompletion(params) {
      return this.chatCompletion(params);
  }
};
