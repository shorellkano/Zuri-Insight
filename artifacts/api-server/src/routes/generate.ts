import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, contentTable } from "@workspace/db";
import {
  GenerateAdCopyBody,
  GenerateSocialPostsBody,
  GenerateEmailBody,
  GenerateWhatsappBody,
  GenerateVideoScriptBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { aiJSON, aiComplete, hasAI } from "../lib/ai.js";
import { buildSystemPrompt } from "../lib/generators/shared.js";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function safeAiJSON<T>(system: string, user: string, maxTokens = 700): Promise<T> {
  const raw = await aiComplete(system, user, maxTokens);
  return JSON.parse(stripJsonFences(raw)) as T;
}

async function saveContent(type: string, brandId: string, prompt: string, content: string, platform?: string, tone?: string) {
  await db.insert(contentTable).values({ type, brandId, prompt, content, platform, tone });
}

// ─── 1. Ad Copy ──────────────────────────────────────────────────────────────

router.post("/generate/ad-copy", async (req, res): Promise<void> => {
  const parsed = GenerateAdCopyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { brandId, prompt, platform = "facebook", tone = "authentic", language = "English", variations = 3 } = parsed.data;
  const count = Math.min(Math.max(variations ?? 3, 1), 5);

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const platformLimits: Record<string, string> = {
    facebook: "Primary text 125 chars, headline 40 chars, description 25 chars",
    instagram: "Caption up to 2200 chars, hook in first 125 chars before 'more' cutoff",
    tiktok: "Caption up to 150 chars, hook must grab in 2 seconds",
    twitter: "280 chars total including spaces and CTA",
    google: "Headline 30 chars x3, description 90 chars x2",
    linkedin: "Intro text 150 chars visible, up to 700 chars total",
  };
  const limits = platformLimits[platform.toLowerCase()] ?? "Platform-appropriate length";

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "ad-copy", platform);
    const user = `Generate ${count} ad copy variations for ${brand.name} on ${platform}.
Product/Offer: ${prompt}
Goal: ${tone}
Platform character limits: ${limits}
Language: ${language}

Return ONLY a JSON array (no fences) with ${count} objects, each:
{
  "variation_number": <number>,
  "hook": "<opening line that stops the scroll>",
  "body": "<main copy that builds desire>",
  "cta": "<call to action>",
  "tone_label": "<e.g. FOMO, Social Proof, Aspirational>",
  "emotional_angle": "<the core emotion being activated>",
  "char_count": <total character count>
}`;

    const variations_data = await safeAiJSON<any[]>(system, user);
    const result = Array.isArray(variations_data) ? variations_data : [variations_data];

    const varList = result.slice(0, count).map((v) => ({
      id: randomUUID(),
      content: JSON.stringify(v),
      platform,
      tone: v.tone_label ?? tone,
    }));

    await Promise.all(varList.map((v) => saveContent("ad-copy", brandId, prompt, v.content, platform, v.tone)));
    res.json({ id: randomUUID(), type: "ad-copy", brandId, variations: varList, savedAt: new Date().toISOString() });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("ad-copy generation error:", err);
    // Fallback
    const fallback = [{ id: randomUUID(), content: `[Ad Copy - ${platform}]\n\nHook: ${prompt}\n\nBody: ${brand.name} delivers exactly what you need - quality you can trust, value you can feel.\n\nCTA: Shop now and experience the difference.`, platform, tone }];
    await Promise.all(fallback.map((v) => saveContent("ad-copy", brandId, prompt, v.content, platform, tone)));
    res.json({ id: randomUUID(), type: "ad-copy", brandId, variations: fallback, savedAt: new Date().toISOString() });
  }
});

// ─── 2. Social Posts ─────────────────────────────────────────────────────────

router.post("/generate/social-posts", async (req, res): Promise<void> => {
  const parsed = GenerateSocialPostsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { brandId, prompt, platform = "instagram", tone, language = "English" } = parsed.data;

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "social-posts", platform);
    const user = `Generate 8 ${platform} post variations for ${brand.name}.
Topic: ${prompt}
Language: ${language}

Return ONLY a JSON array (no fences) with 8 objects, each:
{
  "post_number": <number>,
  "caption": "<full post caption including line breaks>",
  "hashtags": ["<tag1>", "<tag2>", ...],
  "post_format": "<e.g. Story, Carousel, Reel, Static>",
  "best_time": "<e.g. Weekday 7-9pm WAT>",
  "char_count": <caption character count>
}

Rules: Vary the format, angle, and energy across all 8. Some should be punchy, some storytelling, some community-driven.`;

    const posts = await safeAiJSON<any[]>(system, user);
    const result = Array.isArray(posts) ? posts : [posts];

    const varList = result.slice(0, 8).map((p) => ({
      id: randomUUID(),
      content: JSON.stringify(p),
      platform,
      tone: p.post_format ?? "social",
    }));

    await Promise.all(varList.map((v) => saveContent("social-posts", brandId, prompt, v.content, platform, v.tone)));
    res.json({ id: randomUUID(), type: "social-posts", brandId, variations: varList, savedAt: new Date().toISOString() });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("social-posts generation error:", err);
    const fallback = [{ id: randomUUID(), content: `${prompt}\n\nAt ${brand.name}, we believe in community. Every product tells a story - and yours starts here.\n\n#${brand.name.replace(/\s/g, "")} #Africa #OwnYourStory`, platform, tone: "organic" }];
    await Promise.all(fallback.map((v) => saveContent("social-posts", brandId, prompt, v.content, platform, "organic")));
    res.json({ id: randomUUID(), type: "social-posts", brandId, variations: fallback, savedAt: new Date().toISOString() });
  }
});

// ─── 3. Email ────────────────────────────────────────────────────────────────

router.post("/generate/email", async (req, res): Promise<void> => {
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { brandId, prompt, tone = "warm", language = "English" } = parsed.data;

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "email");
    const user = `Write a marketing email for ${brand.name}.
Campaign/Offer: ${prompt}
Email type: ${tone}
Language: ${language}

Return ONLY a JSON object (no fences):
{
  "subject_lines": [
    { "text": "<subject>", "preview_text": "<preheader>", "style": "<e.g. Curiosity, Urgency, Benefit>" },
    { "text": "<subject>", "preview_text": "<preheader>", "style": "<e.g. Social Proof, Story, Direct>" },
    { "text": "<subject>", "preview_text": "<preheader>", "style": "<e.g. Question, FOMO, Value>" },
    { "text": "<subject>", "preview_text": "<preheader>", "style": "<e.g. Personal, Announcement, How-To>" },
    { "text": "<subject>", "preview_text": "<preheader>", "style": "<e.g. Contrarian, Listicle, Emotional>" }
  ],
  "email_body": {
    "greeting": "<personalised opener>",
    "opening_hook": "<first sentence that earns the read>",
    "body_1": "<first body paragraph>",
    "body_2": "<second body paragraph>",
    "cta_text": "<button/link text>",
    "cta_context": "<sentence before or around the CTA>",
    "urgency_line": "<urgency or scarcity line>",
    "sign_off": "<closing>",
    "ps_line": "<P.S. line - often the most read part>"
  },
  "estimated_read_time": "<e.g. 45 seconds>",
  "word_count": <number>
}`;

    const emailResult = await safeAiJSON<any>(system, user);
    const content = JSON.stringify(emailResult);
    await saveContent("email", brandId, prompt, content, "email", tone);

    // Return as a single variation so existing frontend still works
    const varList = [{ id: randomUUID(), content, platform: "email", tone }];
    res.json({ id: randomUUID(), type: "email", brandId, variations: varList, result: emailResult, savedAt: new Date().toISOString() });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("email generation error:", err);
    const fallback = { id: randomUUID(), content: `Subject: Something special from ${brand.name}\n\n${prompt}\n\nDear Valued Customer,\n\nAt ${brand.name}, we've built everything with you in mind.\n\nWarm regards,\nThe ${brand.name} Team`, platform: "email", tone };
    await saveContent("email", brandId, prompt, fallback.content, "email", tone);
    res.json({ id: randomUUID(), type: "email", brandId, variations: [fallback], savedAt: new Date().toISOString() });
  }
});

// ─── 4. WhatsApp ─────────────────────────────────────────────────────────────

router.post("/generate/whatsapp", async (req, res): Promise<void> => {
  const parsed = GenerateWhatsappBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { brandId, prompt, tone, language = "English", variations = 3 } = parsed.data;
  const sequenceLength = Math.min(Math.max(variations ?? 3, 1), 5);

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "whatsapp");
    const user = `Write a WhatsApp message sequence (${sequenceLength} messages) for ${brand.name}.
Offer/Goal: ${prompt}
Language: ${language}

CRITICAL WHATSAPP RULES:
- Personal not corporate - sounds like a real person, not a company
- Under 160 words per message
- Use line breaks for readability (short paragraphs)
- Maximum one emoji per message
- One clear action per message
- Feels like a message from a trusted contact, not a brand blast

Return ONLY a JSON array (no fences) with ${sequenceLength} objects, each:
{
  "message_number": <number>,
  "send_delay": "<e.g. Immediately, After 2 hours, Day 2 morning>",
  "message_text": "<the actual WhatsApp message with line breaks as \\n>",
  "word_count": <number>,
  "action_type": "<e.g. Click link, Reply YES, Save number, Share with friend>"
}`;

    const messages = await safeAiJSON<any[]>(system, user);
    const result = Array.isArray(messages) ? messages : [messages];

    const varList = result.slice(0, sequenceLength).map((m) => ({
      id: randomUUID(),
      content: JSON.stringify(m),
      platform: "whatsapp",
      tone: m.action_type ?? "engagement",
    }));

    await Promise.all(varList.map((v) => saveContent("whatsapp", brandId, prompt, v.content, "whatsapp", v.tone)));
    res.json({ id: randomUUID(), type: "whatsapp", brandId, variations: varList, savedAt: new Date().toISOString() });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("whatsapp generation error:", err);
    const fallback = [{ id: randomUUID(), content: `Hi! 👋\n\n${prompt}\n\n${brand.name} has got you covered.\n\nReply here to learn more!`, platform: "whatsapp", tone: "warm" }];
    await Promise.all(fallback.map((v) => saveContent("whatsapp", brandId, prompt, v.content, "whatsapp", "warm")));
    res.json({ id: randomUUID(), type: "whatsapp", brandId, variations: fallback, savedAt: new Date().toISOString() });
  }
});

// ─── 5. Video Scripts ────────────────────────────────────────────────────────

router.post("/generate/video-scripts", async (req, res): Promise<void> => {
  const parsed = GenerateVideoScriptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { brandId, prompt, platform = "tiktok", tone = "ugc", language = "English" } = parsed.data;
  const scriptType = tone ?? "ugc";

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = await buildSystemPrompt(brandId, "video-scripts", platform);
    let user: string;

    if (scriptType === "hook_pack") {
      user = `Write 10 video hook variations for ${brand.name} on ${platform}.
Product/Concept: ${prompt}
Language: ${language}

Return ONLY a JSON array (no fences) with 10 hook objects, each:
{
  "text": "<the hook line, 1-2 sentences>",
  "style": "<e.g. Bold Claim, Question, Story Open, Controversy, Statistic, Relatable Pain>",
  "why_it_works": "<one sentence explanation>"
}`;
    } else {
      const durationGuide: Record<string, string> = {
        ugc: "15-30 seconds",
        talking_head: "30-60 seconds",
        product_demo: "30-45 seconds",
        brand_story: "60-90 seconds",
        default: "30-60 seconds",
      };
      const duration = durationGuide[scriptType] ?? durationGuide.default;

      user = `Write a ${scriptType.replace(/_/g, " ")} video script for ${brand.name} on ${platform}.
Concept: ${prompt}
Target duration: ${duration}
Language: ${language}

Return ONLY a JSON object (no fences):
{
  "hook": "<opening 2-3 seconds - must stop the scroll>",
  "scenes": [
    {
      "scene_number": 1,
      "duration": "<e.g. 0-3s>",
      "spoken_script": "<exact words to say>",
      "action_note": "<what the person/camera does>",
      "visual_suggestion": "<b-roll or visual direction>"
    }
  ],
  "cta": "<closing call to action>",
  "b_roll_suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "total_word_count": <number>,
  "delivery_notes": "<tone, pace, energy instructions for the talent>"
}`;
    }

    const scriptResult = await safeAiJSON<any>(system, user);
    const content = JSON.stringify(scriptResult);
    await saveContent("video-scripts", brandId, prompt, content, platform, scriptType);

    const isHookPack = scriptType === "hook_pack";
    let varList: { id: string; content: string; platform: string; tone: string }[];

    if (isHookPack && Array.isArray(scriptResult)) {
      varList = scriptResult.map((h) => ({ id: randomUUID(), content: JSON.stringify(h), platform, tone: h.style ?? "hook" }));
    } else {
      varList = [{ id: randomUUID(), content, platform, tone: scriptType }];
    }

    res.json({ id: randomUUID(), type: "video-scripts", brandId, variations: varList, result: scriptResult, savedAt: new Date().toISOString() });
  } catch (err: any) {
    if (err?.message !== "no-ai") console.error("video-scripts generation error:", err);
    const fallback = [{ id: randomUUID(), content: `[VIDEO SCRIPT - ${brand.name}]\n\nHOOK (0-3s): "${prompt}"\n\nBODY (3-25s):\nVoiceover: "At ${brand.name}, we understand what you need."\n\n[Show: Product footage]\n\nCTA (25-30s): "Get yours now. Link in bio."\n\n[End card: Logo]`, platform, tone: scriptType }];
    await Promise.all(fallback.map((v) => saveContent("video-scripts", brandId, prompt, v.content, platform, scriptType)));
    res.json({ id: randomUUID(), type: "video-scripts", brandId, variations: fallback, savedAt: new Date().toISOString() });
  }
});

export default router;
