import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, contentTable, brandDnaTable } from "@workspace/db";
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
import { crawlWebsite } from "../lib/firecrawl.js";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripEmDashes(text: string): string {
  return text.replace(/\u2014/g, " - ");
}

function stripEmDashesDeep<T>(val: T): T {
  if (typeof val === "string") return stripEmDashes(val) as unknown as T;
  if (Array.isArray(val)) return val.map(stripEmDashesDeep) as unknown as T;
  if (val && typeof val === "object") {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, stripEmDashesDeep(v)])) as unknown as T;
  }
  return val;
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function safeAiJSON<T>(system: string, user: string, maxTokens = 500): Promise<T> {
  const raw = await aiComplete(system, user, maxTokens);
  const parsed = JSON.parse(stripJsonFences(raw)) as T;
  return stripEmDashesDeep(parsed);
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

// ─── Quick Plan from Website or Brand ────────────────────────────────────────
// POST /generate/quick-plan
// Crawls a website (if provided) and generates a ready-to-use content plan.
// Works with or without a brand profile.

router.post("/generate/quick-plan", async (req, res): Promise<void> => {
  const { websiteUrl, brandId, duration = "1week" } = req.body;
  if (!websiteUrl && !brandId) {
    res.status(400).json({ error: "websiteUrl or brandId required" });
    return;
  }

  let brandName = "";
  let brandStyleHints = "";
  let websiteContent = "";
  const urlToCrawl = websiteUrl?.trim() || "";

  // Crawl website FIRST if provided - website content is the primary context
  if (urlToCrawl) {
    try {
      websiteContent = await crawlWebsite(urlToCrawl);
    } catch {
      websiteContent = "";
    }
    // Extract domain-based fallback name
    const domainMatch = urlToCrawl.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    brandName = domainMatch?.[1]?.split(".")[0] ?? "Your Brand";
  }

  // Load brand info for STYLE hints only (not to override brand name when URL is provided)
  if (brandId) {
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));
    if (brand) {
      // Only use brand name if no website URL was provided
      if (!urlToCrawl) {
        brandName = brand.name;
        brandStyleHints = `Industry: ${brand.industry ?? "Business"} | Country: ${brand.country ?? "Nigeria"}`;
        if (dna?.toneOfVoice) brandStyleHints += ` | Tone: ${dna.toneOfVoice}`;
        if (dna?.keyMessages?.length) brandStyleHints += ` | Key messages: ${dna.keyMessages.slice(0, 3).join(", ")}`;
      } else {
        // Website URL takes priority for brand identity; use brand profile only for style hints
        if (dna?.toneOfVoice) brandStyleHints = `Preferred tone: ${dna.toneOfVoice}`;
      }
    }
  }

  const durationMap: Record<string, { days: number; label: string }> = {
    "1week": { days: 7, label: "1 week" },
    "1month": { days: 30, label: "1 month" },
    "3months": { days: 90, label: "3 months" },
  };
  const { label } = durationMap[duration] ?? durationMap["1week"];

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = `You are an expert social media strategist specializing in African and Nigerian markets.
Your job is to create highly specific, ready-to-post content plans that feel authentic to the brand.
CRITICAL RULES:
- Read the website content carefully and extract the REAL brand name, products, and unique selling points
- Every caption must reference the brand's actual products/services - NEVER write generic captions
- Captions must be conversational, punchy, and ready to copy-paste
- Include relevant emojis in captions (1-3 max)
- Use Nigerian/African market language where appropriate (e.g., "Oga", "sharp", "level up")
- NEVER use em dashes. Use commas or full stops instead.
- Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

    const contextSection = websiteContent
      ? `SCANNED WEBSITE (${urlToCrawl}):\n${websiteContent.slice(0, 4500)}\n\nFrom this content, identify: the real brand name, their key products/services, target audience, and unique value proposition. Use these to create hyper-specific content.`
      : brandStyleHints
        ? `Brand: ${brandName}\n${brandStyleHints}\n\nCreate content for this business based on the brand details above.`
        : `Business name: ${brandName}\n\nCreate authentic social media content for this business. Infer likely products/services from the brand name and use engaging, relatable content for African and Nigerian markets.`;

    const postCounts: Record<string, number> = { "1week": 7, "1month": 14, "3months": 24 };
    const postCount = postCounts[duration] ?? 7;
    const styleNote = brandStyleHints && urlToCrawl ? `\nContent style hints: ${brandStyleHints}` : "";
    const taskVerb = websiteContent ? "Scan the website content below and create" : "Create";

    const user = `${taskVerb} a ${label} content plan with exactly ${postCount} posts.${styleNote}

${contextSection}

IMPORTANT: First identify the actual brand name from the website content. Use it in your brandName field.

Return JSON with this EXACT shape:
{
  "brandName": "actual brand name extracted from website",
  "brandSummary": "2-sentence description of what this brand does and who it serves - be specific about their products",
  "plan": [
    {
      "id": "post_1",
      "day": 1,
      "platform": "Instagram",
      "contentType": "Carousel",
      "topic": "specific topic referencing a real product or service from the brand",
      "angle": "Promotional",
      "caption": "Ready-to-post caption that mentions the brand and specific product. Max 220 chars. Include 1-2 emojis and a CTA."
    }
  ]
}

Rules for the plan:
- Platform mix: 3 Instagram, 2 Facebook, 1 LinkedIn, 1 TikTok (for 7 posts). Scale proportionally.
- Content type mix: Static, Carousel, Reel, Story - rotate through them
- Angle mix: Promotional, Educational, Engagement, Testimonial, Behind the scenes
- Each caption must be UNIQUE and reference something SPECIFIC from the brand (product name, feature, location, price, etc.)
- NO two captions should sound alike
- NO generic captions like "level up your game" without specifics`;

    const result = await aiJSON<{ brandName?: string; brandSummary: string; plan: Array<{ id: string; day: number; platform: string; contentType: string; topic: string; angle: string; caption: string }> }>(system, user, 3000);

    // Use the AI-extracted brand name if it returned one and a URL was scanned
    const finalBrandName = (urlToCrawl && result.brandName) ? result.brandName : (brandName || "Your Brand");

    res.json({
      brandName: finalBrandName,
      brandSummary: result.brandSummary ?? "",
      duration: label,
      totalPosts: result.plan?.length ?? 0,
      plan: Array.isArray(result.plan) ? result.plan : [],
    });
  } catch (err: any) {
    console.error("quick-plan error:", err);

    // Fallback: return a template plan using brand/website info we already have
    const isRateLimit = err?.isRateLimit || String(err?.message ?? "").includes("429") || String(err?.message ?? "").toLowerCase().includes("busy");
    const postCounts2: Record<string, number> = { "1week": 7, "1month": 14, "3months": 24 };
    const postCount2 = postCounts2[duration] ?? 7;
    const FALLBACK_STRUCTURE = [
      { platform: "Instagram", contentType: "Carousel", angle: "Educational" },
      { platform: "Facebook", contentType: "Static Post", angle: "Promotional" },
      { platform: "Instagram", contentType: "Reel", angle: "Engagement" },
      { platform: "LinkedIn", contentType: "Static Post", angle: "Brand Story" },
      { platform: "TikTok", contentType: "Video", angle: "Behind the Scenes" },
      { platform: "Facebook", contentType: "Story", angle: "Engagement" },
      { platform: "Instagram", contentType: "Static Post", angle: "Promotional" },
      { platform: "Instagram", contentType: "Carousel", angle: "Educational" },
      { platform: "Facebook", contentType: "Reel", angle: "Promotional" },
      { platform: "LinkedIn", contentType: "Article", angle: "Educational" },
      { platform: "Instagram", contentType: "Reel", angle: "Behind the Scenes" },
      { platform: "TikTok", contentType: "Video", angle: "Engagement" },
      { platform: "Facebook", contentType: "Static Post", angle: "Brand Story" },
      { platform: "Instagram", contentType: "Story", angle: "Promotional" },
    ];
    const TOPICS = [
      "What makes us different",
      "Meet the team behind the brand",
      "Our most popular product this week",
      "Customer spotlight",
      "Quick tip for our community",
      "Behind the scenes at our workspace",
      "This week's offer",
    ];
    const plan = Array.from({ length: postCount2 }, (_, i) => {
      const s = FALLBACK_STRUCTURE[i % FALLBACK_STRUCTURE.length];
      return {
        id: `post_${i + 1}`,
        day: i + 1,
        platform: s.platform,
        contentType: s.contentType,
        topic: TOPICS[i % TOPICS.length],
        angle: s.angle,
        caption: `✨ ${brandName ? brandName + " – " : ""}${TOPICS[i % TOPICS.length]}. Tap the link in bio to learn more.`,
      };
    });
    const note = isRateLimit ? " AI was busy so we generated a starter template — edit the topics and captions to match your brand." : "";
    res.json({
      brandName: brandName || "Your Brand",
      brandSummary: `A ${label} content plan ready to customise.${note}`,
      duration: label,
      totalPosts: plan.length,
      plan,
      isTemplateFallback: true,
    });
  }
});

export default router;
