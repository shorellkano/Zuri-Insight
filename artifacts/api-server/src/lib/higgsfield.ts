const HIGGSFIELD_BASE = "https://api.higgsfield.ai/v1";

export interface HiggsfieldJobResult {
  jobId: string;
  status: "pending" | "processing" | "complete" | "failed";
  videoUrl?: string;
  error?: string;
}

export function hasHiggsfield(): boolean {
  return !!process.env.HIGGSFIELD_API_KEY;
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
  const res = await fetch(`${HIGGSFIELD_BASE}/generation`, {
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
    const err = await res.json().catch(() => ({}));
    throw new Error(`Higgsfield API error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<HiggsfieldJobResult>;
}

export async function pollVideoStatus(jobId: string): Promise<HiggsfieldJobResult> {
  if (!process.env.HIGGSFIELD_API_KEY) {
    throw new Error("HIGGSFIELD_API_KEY not configured");
  }
  const res = await fetch(`${HIGGSFIELD_BASE}/generation/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Higgsfield status error: ${res.status}`);
  return res.json() as Promise<HiggsfieldJobResult>;
}
