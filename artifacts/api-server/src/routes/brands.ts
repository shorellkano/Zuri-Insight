import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, brandsTable, brandDnaTable, contentTable } from "@workspace/db";
import {
  CreateBrandBody,
  UpdateBrandBody,
  GetBrandParams,
  UpdateBrandParams,
  DeleteBrandParams,
  GetBrandDnaParams,
  BuildBrandDnaParams,
  ListBrandContentParams,
} from "@workspace/api-zod";
import { crawlWebsite, crawlPage } from "../lib/firecrawl.js";
import { claudeJSON } from "../lib/claude.js";
import { getCulturalContext } from "../lib/cultural/profiles.js";

const router: IRouter = Router();

router.get("/brands", async (req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(desc(brandsTable.createdAt));
  res.json(brands);
});

router.post("/brands", async (req, res): Promise<void> => {
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [brand] = await db.insert(brandsTable).values(parsed.data).returning();
  res.status(201).json(brand);
});

router.get("/brands/:brandId", async (req, res): Promise<void> => {
  const params = GetBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, params.data.brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(brand);
});

router.put("/brands/:brandId", async (req, res): Promise<void> => {
  const params = UpdateBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [brand] = await db.update(brandsTable).set(parsed.data).where(eq(brandsTable.id, params.data.brandId)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(brand);
});

router.delete("/brands/:brandId", async (req, res): Promise<void> => {
  const params = DeleteBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [brand] = await db.delete(brandsTable).where(eq(brandsTable.id, params.data.brandId)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/brands/:brandId/dna", async (req, res): Promise<void> => {
  const params = GetBrandDnaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, params.data.brandId));
  if (!dna) {
    res.status(404).json({ error: "Brand DNA not found. Please build it first." });
    return;
  }
  res.json(dna);
});

router.post("/brands/:brandId/dna", async (req, res): Promise<void> => {
  const params = BuildBrandDnaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, params.data.brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const existing = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, params.data.brandId));

  try {
    // 1. Crawl website
    const websiteText = brand.websiteUrl ? await crawlWebsite(brand.websiteUrl) : "";

    // 2. Crawl social profiles
    const socialData: Record<string, string> = {};
    const handleMap: Record<string, string | null> = {
      instagram: brand.instagramHandle ? `https://www.instagram.com/${brand.instagramHandle.replace("@", "")}/` : null,
      twitter: brand.twitterHandle ? `https://twitter.com/${brand.twitterHandle.replace("@", "")}` : null,
      tiktok: brand.tiktokHandle ? `https://www.tiktok.com/@${brand.tiktokHandle.replace("@", "")}` : null,
      linkedin: brand.linkedinUrl ?? null,
      facebook: brand.facebookUrl ?? null,
    };
    for (const [platform, url] of Object.entries(handleMap)) {
      if (url) {
        socialData[platform] = await crawlPage(url);
      }
    }

    // 3. Get cultural context
    const cultural = getCulturalContext(brand.country ?? "NG");

    // 4. Build DNA with Claude
    const hasRealContent = websiteText.length > 100 || Object.values(socialData).some((v) => v.length > 50);

    let dnaResult: any;

    if (hasRealContent && process.env.ANTHROPIC_API_KEY) {
      const system = `You are a brand intelligence analyst. Return ONLY valid JSON. Never fabricate data. Only extract what you can genuinely identify from the provided content.`;
      const user = `Analyse this brand and return a Brand DNA JSON object.

Brand: ${brand.name}
Industry: ${brand.industry ?? "Unknown"}
Country: ${brand.country ?? "NG"} | Continent: ${brand.continent ?? "Africa"}
Cultural Context: ${JSON.stringify(cultural)}

Website Content:
${websiteText || "No website content available."}

Social Profiles:
${Object.entries(socialData).map(([p, t]) => `${p}: ${t || "Not available"}`).join("\n\n")}

Return ONLY this JSON structure (no explanation, no markdown fences):
{
  "formality": <1-10, where 1=very casual, 10=very formal>,
  "energy": <1-10, where 1=calm/slow, 10=high energy/urgent>,
  "humor": <1-10, where 1=serious, 10=very funny>,
  "boldness": <1-10, where 1=conservative, 10=very bold>,
  "language_register": { "primary": "<language>", "markers": ["<word/phrase>"], "avoid": ["<word/phrase>"] },
  "content_themes": ["<theme1>", "<theme2>"],
  "audience_profile": { "age_range": "<range>", "gender": "<mix>", "income": "<level>", "interests": ["<interest>"], "pain_points": ["<pain>"] },
  "visual_identity": { "colors": ["<color>"], "style": "<style>", "mood": "<mood>" },
  "cultural_context": { "primary_market": "<market>", "trust_signals": ${JSON.stringify(cultural.trust_signals)}, "buying_triggers": ${JSON.stringify(cultural.buying_triggers)}, "festive_peaks": ${JSON.stringify(cultural.festive_peaks)} },
  "power_words": ["<word1>", "<word2>"],
  "taglines_found": ["<tagline>"],
  "brand_summary": "<2-3 sentence brand DNA summary>"
}`;

      dnaResult = await claudeJSON(system, user, 2000);
    } else {
      // Fallback DNA when no API keys or content
      dnaResult = {
        formality: 6,
        energy: 7,
        humor: 4,
        boldness: 7,
        language_register: { primary: brand.language ?? "English", markers: [], avoid: [] },
        content_themes: ["brand story", "product showcase", "community", "lifestyle"],
        audience_profile: { age_range: "25-45", gender: "mixed", income: "middle", interests: ["quality", "value"], pain_points: ["trust", "value for money"] },
        visual_identity: { colors: ["brand colors"], style: "modern", mood: "confident" },
        cultural_context: {
          primary_market: cultural.name,
          trust_signals: cultural.trust_signals,
          buying_triggers: cultural.buying_triggers,
          festive_peaks: cultural.festive_peaks,
        },
        power_words: ["authentic", "quality", "community", "trusted"],
        taglines_found: [],
        brand_summary: `${brand.name} is a ${brand.industry ?? "brand"} serving the ${cultural.name} market with authentic, community-focused products and services.`,
      };
    }

    // 5. Save to DB
    const dnaValues = {
      brandId: params.data.brandId,
      toneOfVoice: dnaResult.brand_summary ?? "",
      coreValues: dnaResult.power_words ?? [],
      targetAudience: JSON.stringify(dnaResult.audience_profile ?? {}),
      uniqueSellingPoints: dnaResult.content_themes ?? [],
      culturalContext: JSON.stringify(dnaResult.cultural_context ?? {}),
      brandPersonality: `Formality: ${dnaResult.formality}/10, Energy: ${dnaResult.energy}/10, Boldness: ${dnaResult.boldness}/10`,
      keyMessages: dnaResult.taglines_found ?? [],
      writingStyle: JSON.stringify(dnaResult.language_register ?? {}),
      builtAt: new Date(),
    };

    let dna;
    if (existing.length > 0) {
      [dna] = await db.update(brandDnaTable).set(dnaValues).where(eq(brandDnaTable.brandId, params.data.brandId)).returning();
    } else {
      [dna] = await db.insert(brandDnaTable).values(dnaValues).returning();
    }

    await db.update(brandsTable).set({ dnaBuilt: true }).where(eq(brandsTable.id, params.data.brandId));

    res.json({ ...dna, dnaResult });
  } catch (err: any) {
    console.error("DNA build error:", err);
    res.status(500).json({ error: err?.message ?? "DNA build failed" });
  }
});

router.get("/brands/:brandId/content", async (req, res): Promise<void> => {
  const params = ListBrandContentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
    .select({
      id: contentTable.id,
      type: contentTable.type,
      brandId: contentTable.brandId,
      brandName: brandsTable.name,
      prompt: contentTable.prompt,
      content: contentTable.content,
      platform: contentTable.platform,
      tone: contentTable.tone,
      createdAt: contentTable.createdAt,
    })
    .from(contentTable)
    .innerJoin(brandsTable, eq(contentTable.brandId, brandsTable.id))
    .where(eq(contentTable.brandId, params.data.brandId))
    .orderBy(desc(contentTable.createdAt));

  res.json(items);
});

export default router;
