/**
 * OpenAI client configuration.
 * Used by embedding service - no OpenAI logic in controllers.
 */
import OpenAI from 'openai';

let client = null;

export function getOpenAIClient() {
  if (!client && process.env.OPENAI_API_KEY?.trim()) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
