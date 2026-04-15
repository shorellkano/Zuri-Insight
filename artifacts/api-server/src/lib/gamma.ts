const GAMMA_API_BASE = "https://public-api.gamma.app/v1.0";

export function hasGamma(): boolean {
  return !!process.env.GAMMA_API_KEY;
}

function getApiKey(): string {
  const key = process.env.GAMMA_API_KEY;
  if (!key) throw new Error("GAMMA_API_KEY is not configured");
  return key;
}

export interface GammaGenerateOptions {
  inputText: string;
  format: "presentation" | "document" | "social";
  numCards?: number;
  textMode?: "generate" | "condense" | "preserve";
  tone?: string;
  cardSize?: "fluid" | "16x9" | "4x3";
  textDensity?: "brief" | "medium" | "detailed";
}

export interface GammaGenerationStatus {
  generationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  gammaUrl?: string;
  exportUrl?: string;
  error?: string;
}

export async function startGammaGeneration(opts: GammaGenerateOptions): Promise<{ generationId: string }> {
  const key = getApiKey();
  const body: Record<string, unknown> = {
    inputText: opts.inputText,
    format: opts.format,
    numCards: opts.numCards ?? 8,
    textMode: opts.textMode ?? "condense",
    cardSize: opts.cardSize ?? "16x9",
    textDensity: opts.textDensity ?? "medium",
  };
  if (opts.tone) body.tone = opts.tone;

  const res = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.message as string) ?? `Gamma API error ${res.status}`);
  }

  return res.json();
}

export async function pollGammaGeneration(generationId: string): Promise<GammaGenerationStatus> {
  const key = getApiKey();
  const res = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    headers: { "X-API-KEY": key },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.message as string) ?? `Gamma API error ${res.status}`);
  }

  return res.json();
}
