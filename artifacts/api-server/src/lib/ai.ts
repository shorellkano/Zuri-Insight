import OpenAI from "openai";

const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

const VISION_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://zuri.ai",
      "X-Title": "Zuri AI",
    },
  });
}

function isRateLimited(err: any): boolean {
  return (
    err?.status === 429 ||
    err?.statusCode === 429 ||
    String(err?.message ?? "").includes("429") ||
    String(err?.message ?? "").toLowerCase().includes("rate limit")
  );
}

export async function aiComplete(system: string, user: string, maxTokens = 600): Promise<string> {
  const client = getClient();
  let lastErr: any;

  for (const model of FREE_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");
      return content;
    } catch (err: any) {
      lastErr = err;
      if (isRateLimited(err)) continue;
      throw err;
    }
  }

  throw lastErr ?? new Error("All AI models are currently busy. Please try again in a moment.");
}

export async function aiVision(system: string, prompt: string, images: string[], maxTokens = 600): Promise<string> {
  const client = getClient();
  const imageContent = images.map(dataUrl => ({
    type: "image_url" as const,
    image_url: { url: dataUrl },
  }));
  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI vision");
  return content;
}

export async function aiJSON<T = any>(system: string, user: string, maxTokens = 600): Promise<T> {
  const raw = await aiComplete(system, user, maxTokens);
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean) as T;
}

export function hasAI(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
