import OpenAI from "openai";

const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "qwen/qwen3-14b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-4-31b-it:free",
];

const ALL_MODELS = FREE_MODELS;

const VISION_MODEL = "meta-llama/llama-3.2-11b-vision-instruct:free";

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

export async function aiComplete(system: string, user: string, maxTokens = 900): Promise<string> {
  const client = getClient();
  let lastErr: any;

  for (const model of ALL_MODELS) {
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
      if (isRateLimited(err) || err?.status === 402 || err?.status === 503) continue;
      throw err;
    }
  }

  throw lastErr ?? new Error("All AI models are currently busy. Please try again in a moment.");
}

export async function aiVision(system: string, prompt: string, images: string[], maxTokens = 900): Promise<string> {
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

  // Strip all markdown code fences (anywhere in the string)
  let clean = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Extract largest JSON object or array from the text
    const objMatch = clean.match(/\{[\s\S]*\}/);
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    const chosen = objMatch && arrMatch
      ? (clean.indexOf(objMatch[0]) <= clean.indexOf(arrMatch[0]) ? objMatch[0] : arrMatch[0])
      : (objMatch?.[0] ?? arrMatch?.[0]);
    if (chosen) {
      try {
        return JSON.parse(chosen) as T;
      } catch {
        // Last resort: strip control characters and retry
        const stripped = chosen.replace(/[\x00-\x1F\x7F]/g, c => c === "\n" || c === "\t" ? c : " ");
        return JSON.parse(stripped) as T;
      }
    }
    throw new Error(`AI returned non-JSON response: ${raw.slice(0, 200)}`);
  }
}

export function hasAI(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
