import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandDnaTable } from "@workspace/db";
import { aiJSON, hasAI } from "../lib/ai.js";

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

router.post("/generate/7day-starter", async (req, res) => {
  const { brandId, weekFocus, website, instagram, phone } = req.body;

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  if (!hasAI()) {
    res.status(503).json({ error: "AI not configured" });
    return;
  }

  // Fetch brand outside try so it's accessible in the catch fallback
  const brand = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId)).then(r => r[0]);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
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

    const systemPrompt = `You are Zuri AI, an expert social media content strategist for African businesses and global emerging markets.
You write punchy, culturally aware content that connects with real people.
Rules:
- Never use em dashes (use commas or regular dashes instead)
- Keep captions human and authentic, not corporate
- Use Lagos, Nairobi, Accra, or local market references where natural
- Hashtags must be realistic and relevant
- TikTok scripts should sound like someone actually talking, casual and direct
- If a website, Instagram handle, or phone number is provided, weave them naturally into CTAs (e.g. "visit yoursite.com", "follow us @handle", "DM or WhatsApp us on +234...")
- Do not invent contact details that were not provided`;

    const dayInstructions = DAY_PLAN.map((d, i) => (
      `Day ${i + 1}: Instagram ${d.instagram.format} (${d.instagram.contentType}) | TikTok UGC Video (${d.tiktok.contentType})`
    )).join("\n");

    const userPrompt = `Generate a complete 7-day Instagram and TikTok content plan for:

${brandContext}

FIXED STRUCTURE - follow exactly:
${dayInstructions}

For each Instagram post write a hook (the first line that stops scrolling) and a full caption with relevant hashtags.
For each TikTok write: hook (first 3-5 words spoken), script (what to say on camera, 3-5 sentences), CTA (closing line), and hashtags.

Return ONLY valid JSON with this structure:
{
  "weekTheme": "short theme for the week",
  "days": [
    {
      "day": 1,
      "instagram": {
        "format": "Reel",
        "contentType": "Quote of the Day",
        "hook": "the first visible line",
        "caption": "full caption text",
        "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"]
      },
      "tiktok": {
        "contentType": "Introduce Yourself and Your Brand",
        "hook": "Opening words",
        "script": "Full talking-camera script",
        "cta": "Closing call to action",
        "hashtags": ["#tag1", "#tag2", "#tag3", "#fyp"]
      }
    }
  ]
}`;

    const result = await aiJSON<{ weekTheme: string; days: any[] }>(systemPrompt, userPrompt, 4000);

    const days = (result.days ?? []).map((d: any) => cleanDay(d));

    res.json({ weekTheme: result.weekTheme ?? "", days });
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
