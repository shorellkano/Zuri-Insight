import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, contentTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { aiJSON, hasAI } from "../lib/ai.js";
import { buildSystemPrompt } from "../lib/generators/shared.js";

const router: IRouter = Router();

const PLATFORM_RULES: Record<string, string> = {
  instagram_reel:
    "Hook: max 8 words, complete thought, creates curiosity or bold claim. Caption: 150-250 words, start with hook, tell a story or give value. Hashtags: 20 hashtags (5 large 1M+, 8 medium 100k-1M, 7 niche under 100k). No hashtags at start. Hashtags at end only.",
  instagram_story:
    "Hook: max 5 words, readable as text overlay. Caption: write as a script for what to say/show on screen. Hashtags: 1-3 only.",
  instagram_feed:
    "Hook: first 125 chars visible before 'more'. Caption: 100-200 words. Hashtags: 15-25, at end only.",
  instagram_carousel:
    "Hook: must make them swipe. Caption: 100-200 words with 'Swipe to see...' CTA. Hashtags: 20-25.",
  tiktok_video:
    "Hook: first 3 words are critical, must be a pattern interrupt. Caption: max 150 chars, punchy. Hashtags: 3-5 only, #fyp always included.",
  tiktok_story:
    "Hook: 5 words max. Caption: 100 chars max. Hashtags: 2-3 only.",
  facebook_post:
    "Hook: first 2 lines show before 'see more' - they must do all the work. Caption: 100-250 words, end with a question. Hashtags: 2-5 max.",
  facebook_reel:
    "Hook: first 3 seconds. Caption: 80-150 words. Hashtags: 3-8.",
  facebook_story:
    "Hook: 5 words max overlay text. Caption: script for what to say. Hashtags: 1-3.",
  linkedin_post:
    "Hook: first 2 lines before 'see more'. Use line breaks every 1-2 sentences. Caption: 150-300 words, no walls of text. Hashtags: 3-5 industry-relevant only.",
  linkedin_article:
    "Hook: compelling opening paragraph. Caption: 200-300 words intro. Hashtags: 3-5.",
  youtube_short:
    "Hook: spoken in first 3 seconds, write as dialogue not a title. Description: 100-200 words, keywords in first 2 sentences, include CTA. Keywords: 10-12 broad and specific.",
  youtube_description:
    "Hook: first 2 lines most important. Description: 150-250 words, keyword-rich. Keywords: 10-15.",
  snapchat_snap:
    "Hook: 3 words max text overlay. Caption: short punchy script. Hashtags: 0-2.",
  snapchat_story:
    "Hook: 4 words max. Caption: script for snap sequence. Hashtags: 0-3.",
};

function platformRules(platform: string, format: string): string {
  const key = `${platform.toLowerCase()}_${format.toLowerCase().replace(/\s+/g, "_")}`;
  return PLATFORM_RULES[key] ?? `Write compelling ${platform} ${format} content that grabs attention and drives engagement.`;
}

function stripEmDashes(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, " - ")
    .replace(/--/g, " - ");
}

function cleanVariation(v: any): any {
  return {
    ...v,
    hook: stripEmDashes(v?.hook),
    caption: stripEmDashes(v?.caption),
    platform_note: stripEmDashes(v?.platform_note),
  };
}

function cleanVideoScript(v: any): any {
  return {
    ...v,
    hook: stripEmDashes(v?.hook),
    script: stripEmDashes(v?.script),
    cta: stripEmDashes(v?.cta),
    caption: stripEmDashes(v?.caption),
    tips: stripEmDashes(v?.tips),
  };
}

router.post("/generate/quick-create", async (req, res): Promise<void> => {
  const { brandId, platform, format, topic, tone = "professional", additionalContext, contentType = "post" } = req.body ?? {};

  if (!brandId || typeof brandId !== "string") { res.status(400).json({ error: "brandId is required" }); return; }
  if (!platform || typeof platform !== "string") { res.status(400).json({ error: "platform is required" }); return; }
  if (!format || typeof format !== "string") { res.status(400).json({ error: "format is required" }); return; }
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) { res.status(400).json({ error: "topic must be at least 3 characters" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const isVideo = contentType === "video";
  const rules = platformRules(platform, format);
  const contentId = randomUUID();

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "quick-create", platform);

    let user: string;

    if (isVideo) {
      user = `Write a short-form video script for ${brand.name} to film themselves talking to camera.

Topic: ${topic}
Tone: ${tone}
Additional context: ${additionalContext ?? "none"}
Platform: ${platform}

Return ONLY a JSON object (no array, no markdown, no fences):
{
  "hook": "<opening spoken line - the first thing they say on camera, max 12 words, punchy>",
  "script": "<talking points body - 3 to 5 bullet points the founder covers, written as spoken words not headers>",
  "cta": "<closing call to action - final spoken line, max 15 words>",
  "caption": "<social media caption for the post, 80-150 words, conversational>",
  "hashtags": [<8 to 15 relevant hashtag strings with #>],
  "duration": "<estimated video duration e.g. 30-45 seconds>",
  "tips": "<2-3 practical filming tips for a solo founder with a phone camera>"
}

Write in ${brand.name}'s brand voice. Keep it natural and conversational - this is spoken word, not text. Never fabricate stats.`;
    } else {
      user = `Generate 1 variation of ${platform} ${format} content for ${brand.name}.

Topic: ${topic}
Tone: ${tone}
Additional context: ${additionalContext ?? "none"}

PLATFORM RULES (follow exactly):
${rules}

Return ONLY a JSON object (no array, no markdown, no fences):
{
  "v": 1,
  "hook": "<hook - compact, max 10 words>",
  "caption": "<caption - max 150 words, punchy>",
  "hashtags": [<hashtag strings with #, follow platform rules for count>],
  "keywords": [<5 keyword strings if youtube/linkedin, else []>],
  "hook_char_count": <number>,
  "caption_char_count": <number>,
  "platform_note": "<one short sentence of posting advice>"
}

Be specific to ${brand.name}'s voice. Never fabricate stats.`;
    }

    const raw = await aiJSON<any>(system, user, isVideo ? 600 : 500);
    const cleaned = isVideo ? cleanVideoScript(raw) : cleanVariation(Array.isArray(raw) ? raw[0] : raw);

    const varList = [{
      id: randomUUID(),
      content: JSON.stringify(cleaned),
      platform,
      tone: format,
    }];

    await Promise.all(
      varList.map((v) =>
        db.insert(contentTable).values({
          type: isVideo ? "video-script" : "quick-create",
          brandId,
          prompt: topic,
          content: v.content,
          platform,
          tone: format,
        })
      )
    );

    res.json({
      id: contentId,
      type: isVideo ? "video-script" : "quick-create",
      contentType,
      brandId,
      platform,
      format,
      variations: varList,
      savedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("quick-create error:", err);

    let fallbackContent: string;

    if (isVideo) {
      fallbackContent = JSON.stringify({
        hook: `Here is what you need to know about ${topic.split(" ").slice(0, 5).join(" ")}`,
        script: `- Start by sharing what this topic means to you and your business\n- Explain how ${brand.name} approaches this differently\n- Share one practical tip your audience can use today\n- Tell them what results to expect`,
        cta: `Follow for more tips and tap the link in bio to get started.`,
        caption: `${topic}\n\nAt ${brand.name}, we believe in keeping it real with you.\n\nSave this if it helped and share with someone who needs to see it.`,
        hashtags: [`#${brand.name.replace(/\s+/g, "")}`, "#AfricanBusiness", "#Founder", "#ContentCreator", "#BusinessTips"],
        duration: "30-45 seconds",
        tips: "Film in natural light near a window. Hold your phone at eye level. Do one practice run before recording.",
      });
    } else {
      fallbackContent = JSON.stringify({
        v: 1,
        hook: topic.split(" ").slice(0, 7).join(" "),
        caption: `${topic}\n\nAt ${brand.name}, we're here to help you make it happen.\n\nReady to get started? Tap the link in bio.`,
        hashtags: [`#${brand.name.replace(/\s+/g, "")}`, "#Africa", "#Business", "#Growth"],
        keywords: [],
        hook_char_count: topic.length,
        caption_char_count: 120,
        platform_note: `This is a starter template for ${platform} ${format}. Customise it to match your brand voice.`,
      });
    }

    const fallback = [
      {
        id: randomUUID(),
        content: fallbackContent,
        platform,
        tone: format,
      },
    ];

    await Promise.all(
      fallback.map((v) =>
        db.insert(contentTable).values({
          type: isVideo ? "video-script" : "quick-create",
          brandId,
          prompt: topic,
          content: v.content,
          platform,
          tone: format,
        })
      )
    );

    res.json({
      id: contentId,
      type: isVideo ? "video-script" : "quick-create",
      contentType,
      brandId,
      platform,
      format,
      variations: fallback,
      savedAt: new Date().toISOString(),
    });
  }
});

export default router;
