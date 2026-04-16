import OpenAI from "openai";

// ─── Model Registry ───────────────────────────────────────────────────────────
// Ordered: reliable models first (lighter global usage), heavy-hitters last.
// The cooldown system means exhausted models get skipped rather than retried.
const FREE_MODELS = [
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "microsoft/phi-4:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "qwen/qwen3-14b:free",
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-4-31b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

const VISION_MODEL = "meta-llama/llama-3.2-11b-vision-instruct:free";

// ─── Per-model cooldown tracker ───────────────────────────────────────────────
// When a model returns 429, mark it as cooling down for COOLDOWN_MS.
// Any request in that window skips the model entirely rather than wasting time.
const COOLDOWN_MS = 90_000; // 90 seconds
const modelCooldowns = new Map<string, number>();

function isModelCooling(model: string): boolean {
  const until = modelCooldowns.get(model);
  if (!until) return false;
  if (Date.now() >= until) { modelCooldowns.delete(model); return false; }
  return true;
}

function markModelRateLimited(model: string): void {
  modelCooldowns.set(model, Date.now() + COOLDOWN_MS);
}

function availableModels(): string[] {
  return FREE_MODELS.filter(m => !isModelCooling(m));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RATE_LIMIT_ERR = Object.assign(
  new Error("AI models are temporarily busy due to high demand. Please wait a moment and try again."),
  { status: 429, isRateLimit: true }
);

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://zuriai.africa",
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logCooldownStatus(): void {
  const cooling = FREE_MODELS.filter(m => isModelCooling(m));
  if (cooling.length > 0) {
    console.log(`[AI] ${cooling.length}/${FREE_MODELS.length} models cooling down. ${FREE_MODELS.length - cooling.length} available.`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function aiComplete(system: string, user: string, maxTokens = 900): Promise<string> {
  const client = getClient();
  let lastErr: any;

  logCooldownStatus();
  const models = availableModels();

  if (models.length === 0) throw RATE_LIMIT_ERR;

  for (const model of models) {
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
      if (isRateLimited(err)) {
        markModelRateLimited(model);
        await sleep(150);
        continue;
      }
      if (err?.status === 402 || err?.status === 503) continue;
      throw err;
    }
  }

  // All available models failed — check if it was rate limits
  if (availableModels().length < FREE_MODELS.length) throw RATE_LIMIT_ERR;
  throw lastErr ?? new Error("All AI models are currently unavailable. Please try again in a moment.");
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

function extractJson<T>(raw: string): T {
  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  try { return JSON.parse(clean) as T; } catch {}
  const objMatch = clean.match(/\{[\s\S]*\}/);
  const arrMatch = clean.match(/\[[\s\S]*\]/);
  const chosen = objMatch && arrMatch
    ? (clean.indexOf(objMatch[0]) <= clean.indexOf(arrMatch[0]) ? objMatch[0] : arrMatch[0])
    : (objMatch?.[0] ?? arrMatch?.[0]);
  if (chosen) {
    try { return JSON.parse(chosen) as T; } catch {}
    const stripped = chosen.replace(/[\x00-\x1F\x7F]/g, c => c === "\n" || c === "\t" ? c : " ");
    return JSON.parse(stripped) as T;
  }
  throw new Error(`No JSON found in AI response: ${raw.slice(0, 200)}`);
}

export async function aiJSON<T = any>(system: string, user: string, maxTokens = 600): Promise<T> {
  const client = getClient();
  let lastErr: any;

  logCooldownStatus();
  const models = availableModels();

  if (models.length === 0) throw RATE_LIMIT_ERR;

  for (const model of models) {
    // Attempt 1: response_format json_object (guarantees JSON from supported models)
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? "";
      if (raw) return extractJson<T>(raw);
    } catch (err: any) {
      if (isRateLimited(err)) {
        markModelRateLimited(model);
        lastErr = err;
        await sleep(150);
        continue;
      }
      if (err?.status === 402 || err?.status === 503) {
        lastErr = err; continue;
      }
      // Model doesn't support json_object → fall through to Attempt 2
      if (err?.status !== 400) { lastErr = err; continue; }
    }

    // Attempt 2: plain completion with robust JSON extraction
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? "";
      if (raw) return extractJson<T>(raw);
    } catch (err: any) {
      lastErr = err;
      if (isRateLimited(err)) {
        markModelRateLimited(model);
        await sleep(150);
        continue;
      }
      if (err?.status === 402 || err?.status === 503) continue;
      throw err;
    }
  }

  if (availableModels().length < FREE_MODELS.length) throw RATE_LIMIT_ERR;
  throw lastErr ?? new Error("All AI models are currently unavailable. Please try again in a moment.");
}

export function hasAI(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/** Expose cooldown state for health/debug endpoint */
export function getModelStatus(): { model: string; available: boolean; coolingUntil?: number }[] {
  return FREE_MODELS.map(model => {
    const until = modelCooldowns.get(model);
    const now = Date.now();
    const available = !until || now >= until;
    return { model, available, ...(until && now < until ? { coolingUntil: until } : {}) };
  });
}
