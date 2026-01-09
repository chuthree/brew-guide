import axios from 'axios';

/**
 * Google Gemini API Adapter
 */
export const geminiAdapter = {
  async chatCompletion({
    apiKey,
    baseURL = 'https://generativelanguage.googleapis.com/v1beta',
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    stream = false,
  }) {
    // Gemini message format conversion could be complex
    // Simplified mapping for now
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model', // Gemini uses 'model' instead of 'assistant'
      parts: [{ text: m.content }]
    }));

    // System instruction is separate in newer Gemini APIs or prepended
    // This is a simplified implementation
    
    const method = stream ? 'streamGenerateContent' : 'generateContent';
    
    const config = {
      method: 'post',
      url: `${baseURL.replace(/\/+$/, '')}/models/${model}:${method}?key=${apiKey}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      },
      responseType: stream ? 'stream' : 'json',
    };

    return axios(config);
  }
};
