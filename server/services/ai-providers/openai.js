import axios from 'axios';

/**
 * OpenAI API Adapter
 */
export const openaiAdapter = {
  async chatCompletion({
    apiKey,
    baseURL = 'https://api.openai.com/v1',
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    stream = false,
    responseFormat,
  }) {
    const config = {
      method: 'post',
      url: `${baseURL.replace(/\/+$/, '')}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      },
      responseType: stream ? 'stream' : 'json',
    };

    return axios(config);
  },

  async visionCompletion({
    apiKey,
    baseURL = 'https://api.openai.com/v1',
    model,
    prompt,
    imageUrls, // Array of base64 URLs or http URLs
    temperature = 0,
    maxTokens = 1000,
  }) {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageUrls.map(url => ({
            type: 'image_url',
            image_url: { url },
          })),
        ],
      },
    ];

    return this.chatCompletion({
      apiKey,
      baseURL,
      model,
      messages,
      temperature,
      maxTokens,
      responseFormat: { type: 'json_object' }, // Assuming we want JSON for vision results usually
    });
  }
};
