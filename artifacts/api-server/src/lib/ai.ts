import OpenAI from "openai";

// ─── Model Registry ───────────────────────────────────────────────────────────
// Verified free on OpenRouter as of 2026-06-09. Ordered: largest/best first.
// The cooldown system (+ 404 skip) means dead or rate-limited models are
// bypassed automatically — always falls through to the next available one.
const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",     // #1  — 550B NVIDIA flagship
  "openai/gpt-oss-120b:free",                    // #2  — OpenAI 120B OSS
  "nvidia/nemotron-3-super-120b-a12b:free",      // #3  — NVIDIA 120B
  "moonshotai/kimi-k2.6:free",                   // #4  — Kimi K2.6 (262k ctx)
  "nousresearch/hermes-3-llama-3.1-405b:free",   // #5  — Hermes 405B
  "meta-llama/llama-3.3-70b-instruct:free",      // #6  — Llama 70B
  "qwen/qwen3-next-80b-a3b-instruct:free",        // #7  — Qwen3 80B
  "google/gemma-4-31b-it:free",                  // #8  — Gemma 4 31B ✅
  "google/gemma-4-26b-a4b-it:free",              // #9  — Gemma 4 26B
  "openai/gpt-oss-20b:free",                     // #10 — OpenAI 20B OSS ✅
  "nvidia/nemotron-3-nano-30b-a3b:free",          // #11 — NVIDIA 30B
  "z-ai/glm-4.5-air:free",                       // #12 — GLM 4.5 Air
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

// Timeout or connection errors — skip this model and try the next one
function isTimeoutOrConnectionError(err: any): boolean {
  const name = String(err?.name ?? "").toLowerCase();
  const msg  = String(err?.message ?? "").toLowerCase();
  return (
    name.includes("timeout") ||
    name.includes("connection") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ECONNRESET"
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

const AI_REQUEST_TIMEOUT_MS = 18_000; // 18s per model attempt — skip slow models fast

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
      }, { timeout: AI_REQUEST_TIMEOUT_MS });
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
      // Timeout / connection drop — skip this model silently, try the next
      if (isTimeoutOrConnectionError(err)) {
        console.warn(`[AI] ${model} timed out — skipping to next model`);
        continue;
      }
      // 404 = model no longer free; 402 = payment needed; 503 = provider down — skip all
      if (err?.status === 404 || err?.status === 402 || err?.status === 503) continue;
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
      }, { timeout: AI_REQUEST_TIMEOUT_MS });
      const raw = response.choices[0]?.message?.content ?? "";
      if (raw) return extractJson<T>(raw);
    } catch (err: any) {
      if (isRateLimited(err)) {
        markModelRateLimited(model);
        lastErr = err;
        await sleep(150);
        continue;
      }
      if (isTimeoutOrConnectionError(err)) {
        console.warn(`[AI] ${model} timed out on JSON attempt 1 — skipping`);
        lastErr = err; continue;
      }
      // 404 = model no longer free; 402 = payment needed; 503 = provider down — skip all
      if (err?.status === 404 || err?.status === 402 || err?.status === 503) {
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
      }, { timeout: AI_REQUEST_TIMEOUT_MS });
      const raw = response.choices[0]?.message?.content ?? "";
      if (raw) return extractJson<T>(raw);
    } catch (err: any) {
      lastErr = err;
      if (isRateLimited(err)) {
        markModelRateLimited(model);
        await sleep(150);
        continue;
      }
      if (isTimeoutOrConnectionError(err)) {
        console.warn(`[AI] ${model} timed out on JSON attempt 2 — skipping`);
        continue;
      }
      // 404 = model no longer free; 402 = payment needed; 503 = provider down — skip all
      if (err?.status === 404 || err?.status === 402 || err?.status === 503) continue;
      throw err;
    }
  }

  if (availableModels().length < FREE_MODELS.length) throw RATE_LIMIT_ERR;
  throw lastErr ?? new Error("All AI models are currently unavailable. Please try again in a moment.");
}

/**
 * Race the top `concurrency` available models simultaneously.
 * Resolves as soon as the first valid JSON response arrives.
 * Falls back to serial aiJSON if all racers fail.
 */
export async function aiJSONRace<T = any>(system: string, user: string, maxTokens = 600, concurrency = 3): Promise<T> {
  const models = availableModels().slice(0, concurrency);

  if (models.length === 0) {
    // Nothing available — serial will throw RATE_LIMIT_ERR
    return aiJSON<T>(system, user, maxTokens);
  }

  const client = getClient();
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  const attempts = models.map(model =>
    client.chat.completions.create(
      { model, max_tokens: maxTokens, response_format: { type: "json_object" }, messages },
      { timeout: AI_REQUEST_TIMEOUT_MS },
    )
    .then(response => {
      const raw = response.choices[0]?.message?.content ?? "";
      if (!raw) throw new Error("Empty response");
      return extractJson<T>(raw);
    })
    .catch(err => {
      if (isRateLimited(err)) markModelRateLimited(model);
      console.warn(`[AI race] ${model} failed: ${err?.status ?? err?.message}`);
      throw err;
    }),
  );

  try {
    // Promise.any: resolves with first success, rejects only if ALL fail
    return await Promise.any(attempts);
  } catch {
    // All racers failed — fall back to full serial pool (different models)
    console.warn(`[AI race] All ${models.length} racers failed — falling back to serial`);
    return aiJSON<T>(system, user, maxTokens);
  }
}

export function hasAI(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// ─── Together AI Image Generation (FLUX.1 Schnell) ────────────────────────────

export function hasImageAI(): boolean {
  return !!process.env.TOGETHER_API_KEY;
}

export interface GenerateImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
}

/**
 * Generate an image using Together AI.
 * Uses stabilityai/stable-diffusion-xl-base-1.0 (SDXL) for high-quality
 * photorealistic images of people and real-world settings.
 * Returns a base64 data URL (data:image/png;base64,...).
 */
export async function generateImage(opts: GenerateImageOptions): Promise<string> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error("TOGETHER_API_KEY is not set");

  const { prompt } = opts;

  // FLUX.1-schnell: designed for crisp, sharp images. Optimal at 4 steps.
  // Resolution must be multiples of 32, max 1440 on any side.
  const rawW = opts.width ?? 1024;
  const rawH = opts.height ?? 1024;
  let width = rawW, height = rawH;
  // Snap to multiples of 32
  width = Math.round(width / 32) * 32;
  height = Math.round(height / 32) * 32;
  // Cap at 1440
  if (width > 1440) { const s = 1440 / width; width = 1440; height = Math.round(height * s / 32) * 32; }
  if (height > 1440) { const s = 1440 / height; height = 1440; width = Math.round(width * s / 32) * 32; }

  const steps = opts.steps ?? 4;

  const response = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell",
      prompt,
      width,
      height,
      steps,
      n: 1,
      response_format: "base64",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Together AI image generation failed (${response.status}): ${err}`);
  }

  const data = await response.json() as { data: Array<{ b64_json?: string; url?: string }> };
  const item = data?.data?.[0];
  if (!item) throw new Error("Together AI returned no image data");

  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item.url) return item.url;
  throw new Error("Together AI image: no b64_json or url in response");
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
