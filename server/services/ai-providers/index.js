import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';
import { geminiAdapter } from './gemini.js';

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
};

export function getAIAdapter(type) {
  switch (type) {
    case AI_PROVIDERS.OPENAI:
      return openaiAdapter;
    case AI_PROVIDERS.ANTHROPIC:
      return anthropicAdapter;
    case AI_PROVIDERS.GEMINI:
      return geminiAdapter;
    default:
      return openaiAdapter; // Default to OpenAI compatible
  }
}
