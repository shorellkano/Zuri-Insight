import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, mediaPostsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { aiJSON, hasAI } from "../lib/ai.js";
import { buildSystemPrompt } from "../lib/generators/shared.js";

const router: IRouter = Router();

const PLATFORM_CAPTION_RULES: Record<string, string> = {
  instagram:
    "Caption: 150-200 words, story-driven, starts with a hook. Hashtags: 20-25 (mix large/medium/niche). End with clear CTA. Line breaks every 2-3 sentences.",
  tiktok:
    "Caption: max 150 chars, punchy and direct. Hashtags: 3-5 only, always include #fyp. No long sentences.",
  facebook:
    "Caption: 100-250 words, conversational, end with a question to drive comments. Hashtags: 2-5 max.",
  linkedin:
    "Caption: 150-300 words, professional tone, insight-driven. Use line breaks. Hashtags: 3-5 industry-relevant only.",
  twitter:
    "Caption: max 280 chars (save 30 for hashtags). Sharp, opinionated or helpful. Hashtags: 1-3.",
  youtube:
    "Description: 150-250 words, keyword-rich in first 2 sentences, include CTA, end with subscribe ask. Keywords: 10-15.",
  snapchat:
    "Caption: script/text overlay style, max 100 chars per snap. Hashtags: 0-2 only.",
  whatsapp:
    "Caption: casual and personal, 50-100 words max. No hashtags. Ends with a conversational nudge.",
  threads:
    "Caption: 100-200 words, authentic and conversational. Hashtags: 0-5, put at end. Keep it human.",
};

function platformRules(platform: string): string {
  const key = platform.toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_CAPTION_RULES[key] ?? `Write a compelling, platform-optimized caption for ${platform} that drives engagement.`;
}

router.post("/generate/media-post", async (req, res): Promise<void> => {
  const {
    brandId,
    mediaUrls = [],
    mediaLabels = [],
    mediaType = "image",
    context = "",
    existingCaption = "",
    category = "",
    callToAction = "",
    platforms = [],
  } = req.body ?? {};

  if (!brandId || typeof brandId !== "string") {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    res.status(400).json({ error: "At least one platform is required" });
    return;
  }
  if (!context && !existingCaption && mediaUrls.length === 0) {
    res.status(400).json({ error: "Provide context, an existing caption, or media to post" });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const mediaDescription = mediaLabels.length > 0
    ? mediaLabels.join("; ")
    : `${mediaType} content for ${brand.name}`;

  const contextBlock = [
    context ? `What this media shows: ${context}` : null,
    mediaDescription ? `Media description: ${mediaDescription}` : null,
    existingCaption ? `Existing caption (improve this): ${existingCaption}` : null,
    callToAction ? `Call to action: ${callToAction}` : null,
    category ? `Category/theme: ${category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const generatedCaptions: Record<string, any> = {};

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "media-post");

    for (const platform of platforms.slice(0, 6)) {
      const rules = platformRules(platform);
      const needsKeywords = ["youtube", "linkedin"].includes(platform.toLowerCase());

      const user = `Generate a caption for a ${mediaType} post on ${platform} for ${brand.name}.

${contextBlock}

PLATFORM RULES:
${rules}

Return ONLY a JSON object (no markdown, no fences):
{
  "caption": "<full optimized caption>",
  "hashtags": [<hashtag strings with #>],
  "keywords": [<5-8 keyword strings if youtube/linkedin, else []>],
  "char_count": <number>,
  "platform_tip": "<one sentence of posting advice for ${platform}>"
}`;

      try {
        const result = await aiJSON<any>(system, user, 700);
        generatedCaptions[platform] = {
          platform,
          caption: result.caption ?? "",
          hashtags: result.hashtags ?? [],
          keywords: result.keywords ?? [],
          char_count: result.char_count ?? (result.caption ?? "").length,
          platform_tip: result.platform_tip ?? "",
        };
      } catch {
        generatedCaptions[platform] = buildFallbackCaption(platform, brand.name, context, callToAction);
      }
    }
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("media-post generation error:", err);

    for (const platform of platforms.slice(0, 6)) {
      generatedCaptions[platform] = buildFallbackCaption(platform, brand.name, context, callToAction);
    }
  }

  const [saved] = await db
    .insert(mediaPostsTable)
    .values({
      brandId,
      mediaUrls: mediaUrls as string[],
      mediaLabels: mediaLabels as string[],
      mediaType,
      context,
      existingCaption,
      category,
      callToAction,
      generatedCaptions,
      platformsPosted: platforms as string[],
      postStatus: "draft",
    })
    .returning();

  res.json({
    id: saved.id,
    brandId,
    mediaType,
    platforms,
    captions: generatedCaptions,
    savedAt: saved.createdAt,
  });
});

function buildFallbackCaption(platform: string, brandName: string, context: string, cta: string) {
  const base = context || `Check out what we have for you at ${brandName}`;
  const ctaLine = cta || "Follow us for more";
  const caption = `${base}\n\n${ctaLine}`;

  const defaultHashtags: Record<string, string[]> = {
    instagram: [`#${brandName.replace(/\s/g, "")}`, "#Africa", "#Business", "#Growth", "#Entrepreneur"],
    tiktok: [`#fyp`, "#africa", "#business"],
    facebook: [`#${brandName.replace(/\s/g, "")}`, "#Business"],
    linkedin: [`#Business`, "#Africa", "#Growth"],
    twitter: ["#Africa", "#Startup"],
    youtube: [],
    snapchat: [],
    whatsapp: [],
    threads: [`#Africa`, "#Business"],
  };

  const hashtags = defaultHashtags[platform.toLowerCase()] ?? [`#${brandName.replace(/\s/g, "")}`, "#Africa"];

  return {
    platform,
    caption,
    hashtags,
    keywords: [],
    char_count: caption.length,
    platform_tip: `Post during peak hours for maximum reach on ${platform}.`,
  };
}

export default router;
