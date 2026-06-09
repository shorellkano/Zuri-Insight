const HIGGSFIELD_BASE = "https://api.higgsfield.ai/v1";
const TIMEOUT_MS = 25_000;

export interface HiggsfieldJobResult {
  jobId: string;
  status: "pending" | "processing" | "complete" | "failed";
  videoUrl?: string;
  error?: string;
}

export function hasHiggsfield(): boolean {
  return !!process.env.HIGGSFIELD_API_KEY;
}

function friendlyError(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return "Higgsfield API key is invalid or has expired. Please check your HIGGSFIELD_API_KEY secret.";
    case 429:
      return "Higgsfield rate limit reached. Please wait a minute and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Higgsfield servers are temporarily unavailable. Please try again in a few minutes.";
    case 522:
    case 524:
      return "Higgsfield servers timed out. They may be under high load — please try again shortly.";
    default:
      return `Higgsfield returned an unexpected error (${status}). Please try again.`;
  }
}

async function higgsfieldFetch(path: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HIGGSFIELD_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Request to Higgsfield timed out after 25 seconds. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateUGCVideo(input: {
  prompt: string;
  imageUrl?: string;
  duration?: "5s" | "10s" | "15s";
  style?: "ugc" | "cinematic" | "product_demo" | "testimonial";
  aspectRatio?: "9:16" | "1:1" | "16:9";
}): Promise<HiggsfieldJobResult> {
  if (!process.env.HIGGSFIELD_API_KEY) {
    throw new Error("HIGGSFIELD_API_KEY not configured in Secrets");
  }

  const res = await higgsfieldFetch("/generation", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      ...(input.imageUrl && { image_url: input.imageUrl }),
      duration: input.duration ?? "10s",
      style: input.style ?? "ugc",
      aspect_ratio: input.aspectRatio ?? "9:16",
    }),
  });

  if (!res.ok) {
    throw new Error(friendlyError(res.status));
  }

  return res.json() as Promise<HiggsfieldJobResult>;
}

export async function pollVideoStatus(jobId: string): Promise<HiggsfieldJobResult> {
  if (!process.env.HIGGSFIELD_API_KEY) {
    throw new Error("HIGGSFIELD_API_KEY not configured");
  }

  const res = await higgsfieldFetch(`/generation/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(friendlyError(res.status));
  }

  return res.json() as Promise<HiggsfieldJobResult>;
}
