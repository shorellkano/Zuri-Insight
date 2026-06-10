import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandDnaTable } from "@workspace/db";
import { aiJSON, aiJSONRace, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

const DAY_PLAN = [
  { instagram: { format: "Reel", contentType: "Quote of the Day" }, tiktok: { contentType: "Introduce Yourself and Your Brand" } },
  { instagram: { format: "Carousel", contentType: "Industry Insight" }, tiktok: { contentType: "Quick Tip #1" } },
  { instagram: { format: "Story", contentType: "Quick Tip" }, tiktok: { contentType: "Relatable Moment or Pain Point" } },
  { instagram: { format: "Reel", contentType: "Meme or Relatable Humour" }, tiktok: { contentType: "Product or Service Walkthrough" } },
  { instagram: { format: "Carousel", contentType: "3 Quick Tips" }, tiktok: { contentType: "Customer Story or Social Proof" } },
  { instagram: { format: "Story", contentType: "Motivational Quote" }, tiktok: { contentType: "Behind the Scenes" } },
  { instagram: { format: "Reel", contentType: "Industry Insight with Strong CTA" }, tiktok: { contentType: "Special Offer or Follow Challenge" } },
];

// ─── In-memory result cache (5 min TTL) ─────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
interface CacheEntry { result: any; expiresAt: number; }
const resultCache = new Map<string, CacheEntry>();

function getCacheKey(brandId: string, weekFocus?: string, website?: string, instagram?: string, phone?: string): string {
  return [brandId, weekFocus ?? "", website ?? "", instagram ?? "", phone ?? ""].join("|");
}

function getCached(key: string): any | null {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { resultCache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: any): void {
  resultCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prune stale entries every 50 writes
  if (resultCache.size % 50 === 0) {
    const now = Date.now();
    for (const [k, v] of resultCache) { if (now > v.expiresAt) resultCache.delete(k); }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function strip(text: string | undefined): string {
  if (!text) return "";
  return text.replace(/\u2014/g, " - ").replace(/\u2013/g, " - ").replace(/--/g, " - ");
}

function cleanDay(d: any) {
  if (!d) return d;
  if (d.instagram) {
    d.instagram.hook = strip(d.instagram.hook);
    d.instagram.caption = strip(d.instagram.caption);
  }
  if (d.tiktok) {
    d.tiktok.hook = strip(d.tiktok.hook);
    d.tiktok.script = strip(d.tiktok.script);
    d.tiktok.cta = strip(d.tiktok.cta);
  }
  return d;
}

function buildFallbackDays(brandName: string, weekFocus?: string) {
  const bName = brandName || "Your Brand";
  const FALLBACK_INSTAGRAM_HOOKS = [
    `The one thing ${bName} does differently`,
    `3 things you didn't know about us`,
    `This is your sign to start today`,
    `POV: You just discovered ${bName}`,
    `5 reasons our customers keep coming back`,
    `That feeling when it just works`,
    `Your week starts here`,
  ];
  const FALLBACK_TIKTOK_HOOKS = [
    `Wait - you need to hear this`,
    `Let me show you something real quick`,
    `Here's the truth about this industry`,
    `This changed everything for us`,
    `Nobody talks about this enough`,
    `Come behind the scenes with us`,
    `Last chance to catch this`,
  ];
  return DAY_PLAN.map((d, i) => cleanDay({
    day: i + 1,
    instagram: {
      format: d.instagram.format,
      contentType: d.instagram.contentType,
      hook: FALLBACK_INSTAGRAM_HOOKS[i] ?? `Day ${i + 1} with ${bName}`,
      caption: `${FALLBACK_INSTAGRAM_HOOKS[i] ?? bName}\n\nAt ${bName}, we're committed to delivering real value to you every day. This is our story and we'd love for you to be part of it.\n\nSave this post and share with someone who needs to see it.\n\n#${bName.replace(/\s+/g, "")} #AfricanBusiness #Growth #SmallBusiness #MadeInAfrica`,
      hashtags: [`#${bName.replace(/\s+/g, "")}`, "#AfricanBusiness", "#Growth", "#Entrepreneur", "#SmallBusiness", "#Nigeria", "#Africa"],
    },
    tiktok: {
      contentType: d.tiktok.contentType,
      hook: FALLBACK_TIKTOK_HOOKS[i] ?? `Day ${i + 1}`,
      script: `Start by introducing yourself and what ${bName} does. Then explain why you started this business and who you serve. Share one thing that makes ${bName} different. End by telling your audience what to do next.`,
      cta: `Follow for more and tap the link in bio to get started.`,
      hashtags: [`#${bName.replace(/\s+/g, "")}`, "#fyp", "#AfricanBusiness", "#BusinessTips"],
    },
  }));
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildBatchPrompt(
  brandContext: string,
  systemPrompt: string,
  daySlice: typeof DAY_PLAN,
  startDay: number,
): { system: string; user: string } {
  const instructions = daySlice.map((d, i) => (
    `Day ${startDay + i}: Instagram ${d.instagram.format} (${d.instagram.contentType}) | TikTok UGC Video (${d.tiktok.contentType})`
  )).join("\n");

  const exampleDay = startDay;
  const user = `Generate Instagram + TikTok content for ONLY these days:

${brandContext}

${instructions}

For each Instagram post: hook (scroll-stopping first line) + caption + 7 hashtags.
For each TikTok: hook (first 3-5 spoken words) + script (3-4 sentences, casual camera talk) + CTA + 4 hashtags.

Return ONLY valid JSON:
{
  "days": [
    {
      "day": ${exampleDay},
      "instagram": { "format": "...", "contentType": "...", "hook": "...", "caption": "...", "hashtags": ["#tag"] },
      "tiktok": { "contentType": "...", "hook": "...", "script": "...", "cta": "...", "hashtags": ["#tag"] }
    }
  ]
}`;

  return { system: systemPrompt, user };
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post("/generate/7day-starter", async (req, res) => {
  const { brandId, weekFocus, website, instagram, phone } = req.body;

  if (!brandId) { res.status(400).json({ error: "brandId is required" }); return; }
  if (!hasAI()) { res.status(503).json({ error: "AI not configured" }); return; }

  const brand = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId)).then(r => r[0]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  // ── Cache check ──────────────────────────────────────────────────────────
  const cacheKey = getCacheKey(brandId, weekFocus, website, instagram, phone);
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[7day] Cache hit for brand ${brandId}`);
    res.json({ ...cached, fromCache: true });
    return;
  }

  try {
    const dnaRows = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)).limit(1);
    const dna = dnaRows[0];

    const brandContext = [
      `Brand: ${brand.name}`,
      brand.industry ? `Industry: ${brand.industry}` : "",
      brand.country ? `Location: ${brand.country}` : "",
      brand.language ? `Language: ${brand.language}` : "",
      dna?.toneOfVoice ? `Brand voice: ${dna.toneOfVoice}` : "",
      dna?.targetAudience ? `Target audience: ${dna.targetAudience}` : "",
      dna?.coreValues ? `Core values: ${dna.coreValues}` : "",
      dna?.culturalContext ? `Cultural context: ${dna.culturalContext}` : "",
      weekFocus ? `This week's focus: ${weekFocus}` : "",
      website ? `Website: ${website}` : "",
      instagram ? `Instagram handle: ${instagram}` : "",
      phone ? `Phone/WhatsApp: ${phone}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are Zuri AI, a social media content strategist for African businesses.
Write punchy, culturally aware content that connects with real people.
Rules:
- Never use em dashes (use commas or regular dashes instead)
- Keep captions human and authentic, not corporate
- Use Lagos, Nairobi, Accra, or local market references where natural
- Hashtags must be realistic and relevant
- TikTok scripts must sound like casual talking-to-camera, not a script
- If website/handle/phone is provided, weave into CTAs naturally
- Never invent contact details not provided`;

    // ── Split into 2 parallel batches, race models for each ──────────────
    const batchA = DAY_PLAN.slice(0, 4); // Days 1-4
    const batchB = DAY_PLAN.slice(4);    // Days 5-7

    const promptA = buildBatchPrompt(brandContext, systemPrompt, batchA, 1);
    const promptB = buildBatchPrompt(brandContext, systemPrompt, batchB, 5);

    // Race top-3 models for each batch, both batches run concurrently
    const [resultA, resultB] = await Promise.all([
      aiJSONRace<{ days: any[] }>(promptA.system, promptA.user, 2000),
      aiJSONRace<{ days: any[] }>(promptB.system, promptB.user, 1600),
    ]);

    const allDays = [
      ...(resultA.days ?? []),
      ...(resultB.days ?? []),
    ]
      .filter(d => d && typeof d.day === "number")
      .sort((a, b) => a.day - b.day)
      .map(d => cleanDay(d));

    // Derive a week theme from first day hook (avoids an extra AI round-trip)
    const weekTheme = weekFocus
      || allDays[0]?.instagram?.contentType
      || `${brand.name} - Week 1`;

    const result = { weekTheme, days: allDays };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    console.error("7-day starter error:", err);

    const isRateLimit = err?.isRateLimit || String(err?.message ?? "").includes("429") || String(err?.message ?? "").toLowerCase().includes("busy");
    const noteText = isRateLimit
      ? "AI was busy - here is a starter template. Edit the captions to match your brand voice and products."
      : "Starter template - edit captions to match your brand.";

    const days = buildFallbackDays(brand.name, weekFocus);
    res.json({
      weekTheme: weekFocus ?? `${brand.name} - Week 1`,
      days,
      isTemplateFallback: true,
      note: noteText,
    });
  }
});

export default router;
