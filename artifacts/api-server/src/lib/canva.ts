const CANVA_BASE = "https://api.canva.com/rest/v1";

async function getCanvaToken(): Promise<string> {
  const res = await fetch(`${CANVA_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.CANVA_CLIENT_ID!,
      client_secret: process.env.CANVA_CLIENT_SECRET!,
      scope: "design:content:write design:content:read asset:read asset:write",
    }),
  });
  if (!res.ok) throw new Error(`Canva auth failed: ${res.status}`);
  const data = await res.json() as any;
  return data.access_token;
}

export async function createCanvaDesign(input: {
  title: string;
  assetType: string;
}): Promise<{ designId: string; editUrl: string } | null> {
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_CLIENT_SECRET) {
    return null;
  }
  try {
    const token = await getCanvaToken();
    const res = await fetch(`${CANVA_BASE}/designs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ asset_type: input.assetType, title: input.title }),
    });
    if (!res.ok) {
      console.warn("Canva design creation failed:", res.status);
      return null;
    }
    const data = await res.json() as any;
    return {
      designId: data.design?.id,
      editUrl: data.design?.urls?.edit_url,
    };
  } catch (e) {
    console.warn("Canva API error:", e);
    return null;
  }
}

export function getCanvaAssetType(platform: string, format: string): string {
  const map: Record<string, string> = {
    instagram_feed: "instagram_post",
    instagram_reel: "instagram_reel",
    instagram_story: "instagram_story",
    tiktok_video: "tiktok_video",
    linkedin_post: "linkedin_post",
    facebook_post: "facebook_post",
    youtube_short: "youtube_short",
  };
  return map[`${platform}_${format}`] ?? "instagram_post";
}

export function hasCanva(): boolean {
  return !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
}
