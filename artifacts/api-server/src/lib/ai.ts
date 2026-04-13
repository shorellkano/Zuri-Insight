import OpenAI from "openai";

const MODEL = "google/gemini-2.0-flash-exp:free";

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

export async function aiComplete(system: string, user: string, maxTokens = 600): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");
  return content;
}

export async function aiVision(system: string, prompt: string, images: string[], maxTokens = 600): Promise<string> {
  const client = getClient();
  const imageContent = images.map(dataUrl => ({
    type: "image_url" as const,
    image_url: { url: dataUrl },
  }));
  const response = await client.chat.completions.create({
    model: MODEL,
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
