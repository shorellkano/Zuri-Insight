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

const router: IRouter = Router();

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
  generateVariations: (brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count?: number) => { id: string; content: string; platform?: string; tone?: string }[]
) {
  const { brandId, prompt, platform, tone, variations = 3 } = body;

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) return null;

  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));

  const varList = generateVariations(brand, dna ?? null, prompt, platform, tone, variations);

  const savedItems = await Promise.all(
    varList.map((v) =>
      db.insert(contentTable).values({
        type,
        brandId,
        prompt,
        content: v.content,
        platform: v.platform ?? platform,
        tone: v.tone ?? tone,
      }).returning()
    )
  );

  return {
    id: randomUUID(),
    type,
    brandId,
    variations: varList,
    savedAt: new Date().toISOString(),
  };
}

function makeAdCopyVariations(brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count = 3) {
  const toneStr = tone ?? dna?.toneOfVoice ?? "warm and confident";
  const cultural = dna?.culturalContext ?? "Pan-African";
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    id: randomUUID(),
    content: [
      `[${brand.name} — Ad Copy v${i + 1}]\n\n${prompt}\n\nDiscover the ${brand.industry ?? "difference"} that speaks to your community. ${cultural} — made for you, by people who understand you.\n\nTone: ${toneStr}. Shop now and experience excellence.`,
      `Breaking barriers, building legacies. ${brand.name} brings you ${prompt}.\n\nBecause you deserve a brand that celebrates who you are. ${cultural} pride, world-class quality.\n\n#${brand.name.replace(/\s/g, "")} #MadeForAfrica`,
      `The world is watching Africa rise — and ${brand.name} is leading the charge.\n\n${prompt}\n\nJoin thousands across the continent who've chosen excellence. Limited offer — act now.`,
    ][i],
    platform: platform ?? "general",
    tone: toneStr,
  }));
}

function makeSocialVariations(brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count = 3) {
  const toneStr = tone ?? dna?.toneOfVoice ?? "authentic";
  const cultural = dna?.culturalContext ?? "Pan-African";
  const plat = platform ?? "Instagram";
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    id: randomUUID(),
    content: [
      `${prompt}\n\nAt ${brand.name}, we believe in the power of ${cultural} communities. Every product tells a story — and yours starts here.\n\n#${brand.name.replace(/\s/g, "")} #Africa #OwnYourStory`,
      `Real people. Real stories. Real impact.\n\n${prompt}\n\n${brand.name} stands for excellence in everything we do. Tag someone who needs to see this! 👀\n\n#AfricanBusiness #${brand.name.replace(/\s/g, "")}`,
      `Did you know? ${prompt}\n\nThat's why ${brand.name} exists — to give ${cultural} communities the best. Follow us for more.\n\n#${plat.replace(/\//g, "")} #${brand.name.replace(/\s/g, "")} #QualityFirst`,
    ][i],
    platform: plat,
    tone: toneStr,
  }));
}

function makeEmailVariations(brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count = 3) {
  const toneStr = tone ?? "professional yet warm";
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    id: randomUUID(),
    content: [
      `Subject: You deserve the best — here's why ${brand.name} delivers\n\nDear Valued Customer,\n\n${prompt}\n\nAt ${brand.name}, we've built everything with you in mind. Your trust means everything to us, and we're committed to excellence every step of the way.\n\nWarm regards,\nThe ${brand.name} Team`,
      `Subject: Exclusive: ${prompt}\n\nHello,\n\nWe have something special for our community.\n\n${prompt}\n\nThis is your chance to experience what makes ${brand.name} different. Don't miss out — this offer is for you.\n\nWith gratitude,\n${brand.name}`,
      `Subject: A message from the heart of ${brand.name}\n\nTo our incredible community,\n\n${prompt}\n\nYour journey with us is just beginning, and we're honored to be part of it. Together, we're building something remarkable.\n\nWith African pride,\nTeam ${brand.name}`,
    ][i],
    platform: "email",
    tone: toneStr,
  }));
}

function makeWhatsappVariations(brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count = 3) {
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    id: randomUUID(),
    content: [
      `Hi! 👋 ${prompt} — ${brand.name} has got you covered. Check us out and let's talk! Reply here or visit our page.`,
      `Hello from ${brand.name}! ✨ ${prompt}. We'd love to show you how we can help. Send us a message and we'll get back to you right away!`,
      `${brand.name} here! ${prompt}. Limited availability — reach out now and be first in line. We're just a message away! 🙌`,
    ][i],
    platform: "whatsapp",
    tone: "conversational",
  }));
}

function makeVideoScriptVariations(brand: { name: string; industry?: string | null }, dna: { toneOfVoice: string; culturalContext: string; brandPersonality: string } | null, prompt: string, platform?: string, tone?: string, count = 3) {
  const cultural = dna?.culturalContext ?? "Pan-African";
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    id: randomUUID(),
    content: [
      `[VIDEO SCRIPT v${i + 1} — ${brand.name}]\n\nHOOK (0-3s): "${prompt}"\n\nBODY (3-25s):\nVoiceover: "At ${brand.name}, we understand ${cultural} communities like no one else. That's why we've created something truly special — for you, by people who get you."\n\n[Show: Product/service footage with cultural imagery]\n\nCTA (25-30s): "Join the movement. ${brand.name}. Link in bio."\n\n[End card: Logo + Social handles]`,
    ][0],
    platform: platform ?? "TikTok/Reels",
    tone: tone ?? "energetic",
  }));
}

router.post("/generate/ad-copy", async (req, res): Promise<void> => {
  const parsed = GenerateAdCopyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await generateContent("ad-copy", parsed.data, makeAdCopyVariations);
  if (!result) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(result);
});

router.post("/generate/social-posts", async (req, res): Promise<void> => {
  const parsed = GenerateSocialPostsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await generateContent("social-posts", parsed.data, makeSocialVariations);
  if (!result) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(result);
});

router.post("/generate/email", async (req, res): Promise<void> => {
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await generateContent("email", parsed.data, makeEmailVariations);
  if (!result) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(result);
});

router.post("/generate/whatsapp", async (req, res): Promise<void> => {
  const parsed = GenerateWhatsappBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await generateContent("whatsapp", parsed.data, makeWhatsappVariations);
  if (!result) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(result);
});

router.post("/generate/video-scripts", async (req, res): Promise<void> => {
  const parsed = GenerateVideoScriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await generateContent("video-scripts", parsed.data, makeVideoScriptVariations);
  if (!result) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(result);
});

export default router;
