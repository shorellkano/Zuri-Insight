// Delegates to the OpenRouter-based AI client
// Kept for API compatibility — all logic lives in lib/ai.ts
import { aiComplete, aiJSON } from "./ai";

export async function claudeComplete(system: string, user: string, maxTokens = 2000): Promise<string> {
  return aiComplete(system, user, maxTokens);
}

export async function claudeJSON<T = any>(system: string, user: string, maxTokens = 2000): Promise<T> {
  return aiJSON<T>(system, user, maxTokens);
}
