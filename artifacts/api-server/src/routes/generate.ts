import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandDnaTable, contentTable } from "@workspace/db";
import {
  GenerateAdCopyBody,
  GenerateSocialPostsBody,
  GenerateEmailBody,
  GenerateWhatsappBody,
  GenerateVideoScriptBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { aiComplete, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

// ─── Brand + DNA loader ─────────────────────────────────────────────────────

async function loadBrandAndDna(brandId: string) {
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) return null;
  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));
  return { brand, dna: dna ?? null };
}

function buildDnaContext(brand: typeof brandsTable.$inferSelect, dna: typeof brandDnaTable.$inferSelect | null): string {
  const lines: string[] = [
    `Brand: ${brand.name}`,
    `Industry: ${brand.industry ?? "Unknown"}`,
    `Country: ${brand.country ?? "Africa"} | City: ${brand.city ?? "Unknown"}`,
    `Language: ${brand.language ?? "English"}`,
    `Target Market: ${brand.targetMarket ?? "African consumers"}`,
  ];
  if (dna) {
    lines.push(`Brand Voice: ${dna.toneOfVoice}`);
    lines.push(`Core Values: ${dna.coreValues?.join(", ")}`);
    lines.push(`Brand Personality: ${dna.brandPersonality}`);
    lines.push(`Cultural Context: ${dna.culturalContext}`);
    lines.push(`Writing Style: ${dna.writingStyle}`);
    if (dna.keyMessages?.length) lines.push(`Key Messages: ${dna.keyMessages.join(" | ")}`);
  }
  return lines.join("\n");
}

// ─── AI generate helper ──────────────────────────────────────────────────────

async function aiGenerateVariations(
  type: string,
  systemPrompt: string,
  userPrompt: string,
  platform: string,
  tone: string,
  count: number
): Promise<{ id: string; content: string; platform: string; tone: string }[]> {
  const fullSystem = `${systemPrompt}

You are generating ${count} distinct variation(s). Return ONLY the numbered variations in this exact format:
---VARIATION 1---
<content here>
---VARIATION 2---
<content here>
(and so on)

Do not include explanations, titles, or anything outside this format.`;

  const raw = await aiComplete(fullSystem, userPrompt, 2048);

  // Parse numbered variations
  const parts = raw.split(/---VARIATION \d+---/).filter((s) => s.trim().length > 0);

  if (parts.length === 0) {
    // Fallback: treat entire response as one variation
    return [{ id: randomUUID(), content: raw.trim(), platform, tone }];
  }

  return parts.slice(0, count).map((content) => ({
    id: randomUUID(),
    content: content.trim(),
    platform,
    tone,
  }));
}

// ─── Fallback templates ──────────────────────────────────────────────────────

function fallbackVariations(
  type: string,
  brand: typeof brandsTable.$inferSelect,
  dna: typeof brandDnaTable.$inferSelect | null,
  prompt: string,
  platform: string,
  tone: string,
  count: number
): { id: string; content: string; platform: string; tone: string }[] {
  const toneStr = tone || dna?.toneOfVoice || "warm and confident";
  const cultural = dna?.culturalContext ? JSON.parse(dna.culturalContext)?.primary_market ?? "Africa" : "Africa";

  const templates: Record<string, string[]> = {
    "ad-copy": [
      `[${brand.name}]\n\n${prompt}\n\nDiscover excellence that speaks to your community. ${cultural} quality — made for you.\n\nShop now and experience the difference.`,
      `Breaking barriers, building legacies. ${brand.name} brings you ${prompt}.\n\nBecause you deserve a brand that celebrates who you are. ${cultural} pride, world-class quality.\n\n#${brand.name.replace(/\s/g, "")} #MadeForAfrica`,
      `The world is watching Africa rise — and ${brand.name} is leading the charge.\n\n${prompt}\n\nJoin thousands who've chosen excellence. Act now.`,
    ],
    "social-posts": [
      `${prompt}\n\nAt ${brand.name}, we believe in community. Every product tells a story — and yours starts here.\n\n#${brand.name.replace(/\s/g, "")} #Africa #OwnYourStory`,
      `Real people. Real impact.\n\n${prompt}\n\n${brand.name} stands for excellence. Tag someone who needs to see this! 👀\n\n#AfricanBusiness #${brand.name.replace(/\s/g, "")}`,
      `Did you know? ${prompt}\n\nThat's why ${brand.name} exists. Follow us for more.\n\n#${brand.name.replace(/\s/g, "")} #QualityFirst`,
    ],
    "email": [
      `Subject: You deserve the best — here's why ${brand.name} delivers\n\nDear Valued Customer,\n\n${prompt}\n\nAt ${brand.name}, we've built everything with you in mind.\n\nWarm regards,\nThe ${brand.name} Team`,
      `Subject: Exclusive: ${prompt}\n\nHello,\n\nWe have something special for our community.\n\n${prompt}\n\nDon't miss out.\n\nWith gratitude,\n${brand.name}`,
    ],
    "whatsapp": [
      `Hi! 👋 ${prompt} — ${brand.name} has got you covered. Reply here to learn more!`,
      `Hello from ${brand.name}! ✨ ${prompt}. We'd love to help. Message us now!`,
    ],
    "video-scripts": [
      `[VIDEO SCRIPT — ${brand.name}]\n\nHOOK (0-3s): "${prompt}"\n\nBODY (3-25s):\nVoiceover: "At ${brand.name}, we understand what ${cultural} communities need. That's why we've created something truly special — for you."\n\n[Show: Product footage with cultural imagery]\n\nCTA (25-30s): "Join the movement. ${brand.name}. Link in bio."\n\n[End card: Logo + Social handles]`,
    ],
  };

  const list = templates[type] ?? templates["ad-copy"];
  return list.slice(0, count).map((content) => ({ id: randomUUID(), content, platform, tone: toneStr }));
}

// ─── Core generator ──────────────────────────────────────────────────────────

type GenerateBody = {
  brandId: string;
  prompt: string;
  platform?: string;
  tone?: string;
  language?: string;
  culturalContext?: string;
  variations?: number;
};

async function generateContent(
  type: string,
  body: GenerateBody,
  buildSystemPrompt: (dnaContext: string, platform: string, tone: string, language: string) => string,
  buildUserPrompt: (brand: typeof brandsTable.$inferSelect, dna: typeof brandDnaTable.$inferSelect | null, prompt: string, platform: string, tone: string, count: number) => string
) {
  const { brandId, prompt, platform = "general", tone = "authentic", language = "English", variations = 3 } = body;
  const count = Math.min(Math.max(variations, 1), 3);

  const loaded = await loadBrandAndDna(brandId);
  if (!loaded) return null;

  const { brand, dna } = loaded;
  const dnaContext = buildDnaContext(brand, dna);

  let varList: { id: string; content: string; platform: string; tone: string }[];

  if (hasAI()) {
    try {
      const systemPrompt = buildSystemPrompt(dnaContext, platform, tone, language);
      const userPrompt = buildUserPrompt(brand, dna, prompt, platform, tone, count);
      varList = await aiGenerateVariations(type, systemPrompt, userPrompt, platform, tone, count);
    } catch (err) {
      console.error(`AI generation failed for ${type}:`, err);
      varList = fallbackVariations(type, brand, dna, prompt, platform, tone, count);
    }
  } else {
    varList = fallbackVariations(type, brand, dna, prompt, platform, tone, count);
  }

  await Promise.all(
    varList.map((v) =>
      db.insert(contentTable).values({ type, brandId, prompt, content: v.content, platform: v.platform, tone: v.tone }).returning()
    )
  );

  return { id: randomUUID(), type, brandId, variations: varList, savedAt: new Date().toISOString() };
}

// ─── Route handlers ──────────────────────────────────────────────────────────

router.post("/generate/ad-copy", async (req, res): Promise<void> => {
  const parsed = GenerateAdCopyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await generateContent(
    "ad-copy",
    parsed.data,
    (dnaCtx, platform, tone, language) => `You are an expert marketing copywriter specialising in African and emerging-market brands. You deeply understand cultural nuances, local buying triggers, and what makes content resonate in these markets.

${dnaCtx}

Write compelling ad copy that:
- Matches the brand's voice and personality exactly
- Resonates with the target cultural context
- Creates urgency and desire without being pushy
- Uses culturally relevant hooks and phrases
- Fits the platform: ${platform}
- Tone: ${tone}
- Language: ${language}`,
    (brand, dna, prompt, platform, tone, count) =>
      `Create ${count} distinct ad copy variation(s) for ${brand.name}.

Brief/Goal: ${prompt}
Platform: ${platform}
Tone: ${tone}

Each variation should have a different angle (e.g., emotional, social proof, FOMO, aspirational). Keep each under 150 words.`
  );

  if (!result) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(result);
});

router.post("/generate/social-posts", async (req, res): Promise<void> => {
  const parsed = GenerateSocialPostsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await generateContent(
    "social-posts",
    parsed.data,
    (dnaCtx, platform, tone, language) => `You are a social media expert for African brands. You create scroll-stopping posts that get engagement.

${dnaCtx}

Create posts that:
- Fit ${platform}'s native style and culture
- Use relevant hashtags (5-10 max)
- Include emojis naturally (not forced)
- Drive likes, comments, and shares
- Feel authentic to the brand voice
- Language: ${language}`,
    (brand, dna, prompt, platform, tone, count) =>
      `Create ${count} distinct ${platform} post(s) for ${brand.name}.

Topic/Goal: ${prompt}
Platform: ${platform}
Tone: ${tone}

Each post should have a different hook and angle. Optimised for ${platform} algorithm and culture.`
  );

  if (!result) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(result);
});

router.post("/generate/email", async (req, res): Promise<void> => {
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await generateContent(
    "email",
    parsed.data,
    (dnaCtx, platform, tone, language) => `You are an email marketing specialist for African brands. You write emails that get opened, read, and clicked.

${dnaCtx}

Write emails that:
- Have compelling subject lines
- Open with a strong hook
- Build trust and connection with the reader
- Have a clear, single call-to-action
- Feel personal and culturally relevant
- Language: ${language}

Format: Subject line first, then email body.`,
    (brand, dna, prompt, platform, tone, count) =>
      `Write ${count} email variation(s) for ${brand.name}.

Campaign Goal: ${prompt}
Tone: ${tone}

Each email should have a different subject line and opening angle. Keep it under 300 words.`
  );

  if (!result) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(result);
});

router.post("/generate/whatsapp", async (req, res): Promise<void> => {
  const parsed = GenerateWhatsappBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await generateContent(
    "whatsapp",
    parsed.data,
    (dnaCtx, platform, tone, language) => `You are a WhatsApp Business messaging expert for African brands. WhatsApp is the #1 business channel across Africa.

${dnaCtx}

Write WhatsApp messages that:
- Feel personal and conversational (like a friend)
- Are concise and scannable (under 100 words)
- Use emojis tastefully
- Have a clear ask or CTA
- Don't feel like spam
- Sound authentic to how people actually text in ${language}`,
    (brand, dna, prompt, platform, tone, count) =>
      `Write ${count} WhatsApp message variation(s) for ${brand.name}.

Message Goal: ${prompt}
Tone: ${tone}

Each message should feel personal and drive action. Keep each under 100 words.`
  );

  if (!result) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(result);
});

router.post("/generate/video-scripts", async (req, res): Promise<void> => {
  const parsed = GenerateVideoScriptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await generateContent(
    "video-scripts",
    parsed.data,
    (dnaCtx, platform, tone, language) => `You are a video script writer specialising in short-form African brand content (TikTok, Reels, YouTube Shorts).

${dnaCtx}

Write scripts that:
- Hook in the first 3 seconds
- Have a clear story arc (hook → value → CTA)
- Are optimised for ${platform}
- Use visual direction cues [like this] for b-roll and overlays
- Fit the brand voice perfectly
- Are 30-60 seconds when spoken aloud
- Language: ${language}`,
    (brand, dna, prompt, platform, tone, count) =>
      `Write ${count} video script variation(s) for ${brand.name}.

Video Concept: ${prompt}
Platform: ${platform}
Tone: ${tone}

Format each script with: HOOK (0-3s), BODY (3-25s), CTA (25-30s). Include [visual direction] in brackets.`
  );

  if (!result) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(result);
});

export default router;
