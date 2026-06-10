import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, brandsTable, brandDnaTable, contentTable, brandVisualPrefsTable } from "@workspace/db";
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
import { crawlWebsite, crawlPage, crawlBrandAssets } from "../lib/firecrawl.js";
import { aiJSON, aiVision, hasAI } from "../lib/ai.js";
import { getCulturalContext } from "../lib/cultural/profiles.js";

const router: IRouter = Router();

router.get("/brands", async (req, res): Promise<void> => {
  try {
    const brands = await db.select().from(brandsTable).orderBy(desc(brandsTable.createdAt));
    res.json(brands);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch brands" });
  }
});

router.post("/brands", async (req, res): Promise<void> => {
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [brand] = await db.insert(brandsTable).values(parsed.data).returning();
    res.status(201).json(brand);
  } catch (err: any) {
    const msg = err?.message ?? "Failed to save brand";
    console.error("[POST /brands] DB error:", msg, err?.code, err?.detail);
    res.status(500).json({ error: msg });
  }
});

router.get("/brands/:brandId", async (req, res): Promise<void> => {
  const params = GetBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, params.data.brandId));
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch brand" });
  }
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
  try {
    const [brand] = await db.update(brandsTable).set(parsed.data).where(eq(brandsTable.id, params.data.brandId)).returning();
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to update brand" });
  }
});

router.delete("/brands/:brandId", async (req, res): Promise<void> => {
  const params = DeleteBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [brand] = await db.delete(brandsTable).where(eq(brandsTable.id, params.data.brandId)).returning();
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete brand" });
  }
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

router.post("/brands/:brandId/analyze-screenshots", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { images, hasVideo } = req.body as { images: string[]; hasVideo?: boolean };

  if (!Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: "No images provided" });
    return;
  }
  if (images.length > 5) {
    res.status(400).json({ error: "Maximum 5 screenshots allowed" });
    return;
  }
  // Validate that each entry looks like a base64 data URL
  const validImages = images.filter(img => typeof img === "string" && img.startsWith("data:image/"));
  if (validImages.length === 0) {
    res.status(400).json({ error: "Invalid image format" });
    return;
  }
  if (!hasAI()) {
    res.status(503).json({ error: "AI not configured" });
    return;
  }

  try {
    const mediaContext = hasVideo
      ? "screenshots and video frames (frames were extracted at even intervals from one or more short videos)"
      : "screenshots";

    const system = `You are a brand intelligence expert. Your job is to analyse ${mediaContext} of a brand's social media profile or content (Instagram, TikTok, Twitter/X, LinkedIn, etc.) and extract a clear, factual Brand Brief. Write in plain English. Be specific - use actual words, phrases and tone cues you can see. Do NOT invent anything not visible in the provided images.`;

    const prompt = `These are ${mediaContext} from a brand's social media profile and/or content.${hasVideo ? " Some images are sequential frames from the same video - read them together to understand the full content." : ""}

Please extract and write a Brand Brief that covers:
1. What the brand does (product/service)
2. Who their target audience appears to be
3. Their tone of voice and communication style (based on captions, bio text, on-screen text you can see)
4. Any values, personality traits or positioning that comes through
5. Any taglines, slogans or key phrases visible

Write this as 3-5 sentences in plain English that a marketing team could use to brief a content writer. Only include what you can actually see - do not guess or infer beyond what is visible.`;

    const brief = await aiVision(system, prompt, validImages, 500);
    res.json({ brief: brief.trim() });
  } catch (err: any) {
    console.error("Screenshot analysis error:", err);
    res.status(500).json({ error: "Failed to analyse screenshots. Please try again." });
  }
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

  const [existing] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, params.data.brandId));

  // Cultural context needed in both try and catch (fallback) paths
  const cultural = getCulturalContext(brand.country ?? "NG");

  try {
    // 1. Crawl website + detect brand assets (colors, logo) concurrently
    const [websiteText, detectedAssets] = await Promise.all([
      brand.websiteUrl ? crawlWebsite(brand.websiteUrl) : Promise.resolve(""),
      brand.websiteUrl ? crawlBrandAssets(brand.websiteUrl) : Promise.resolve({ logoUrl: null as string | null, colors: [] as string[] }),
    ]);

    // 2. Crawl social profiles using crawlPage() for each handle
    const socialData: Record<string, string> = {};
    const handleMap: Record<string, string | null> = {
      instagram: brand.instagramHandle ? `https://www.instagram.com/${brand.instagramHandle.replace("@", "")}/` : null,
      twitter: brand.twitterHandle ? `https://twitter.com/${brand.twitterHandle.replace("@", "")}` : null,
      tiktok: brand.tiktokHandle ? `https://www.tiktok.com/@${brand.tiktokHandle.replace("@", "")}` : null,
      linkedin: brand.linkedinUrl ?? null,
      facebook: brand.facebookUrl ?? null,
      youtube: brand.youtubeHandle ? `https://www.youtube.com/@${brand.youtubeHandle.replace("@", "")}` : null,
    };
    for (const [platform, url] of Object.entries(handleMap)) {
      if (url) {
        socialData[platform] = await crawlPage(url);
      }
    }

    // 3b. Brand brief (always available - written by the brand owner)
    const brandBrief = brand.brandBrief ?? "";

    // 4. Check content quality before calling AI
    // Social platforms (Instagram, TikTok, Twitter) actively block scrapers - socialData will usually be empty.
    // brandBrief is the reliable fallback for brands without a scrapeable website.
    const scrapedLength = websiteText.length + Object.values(socialData).join("").length;
    const totalContentLength = scrapedLength + brandBrief.length;
    const hasEnoughContent = totalContentLength >= 100;

    if (!hasEnoughContent) {
      const insufficientMsg = "Not enough brand information to build a DNA. Please add a Brand Brief in your brand settings describing what your brand does, who it serves, and your tone of voice.";
      const failValues = {
        brandId: params.data.brandId,
        buildStatus: "failed",
        errorMessage: insufficientMsg,
        toneOfVoice: "", coreValues: [], targetAudience: "", uniqueSellingPoints: [],
        culturalContext: "", brandPersonality: "", keyMessages: [], writingStyle: "", builtAt: new Date(),
      };
      if (existing) {
        await db.update(brandDnaTable).set(failValues).where(eq(brandDnaTable.brandId, params.data.brandId));
      } else {
        await db.insert(brandDnaTable).values(failValues);
      }
      res.status(422).json({ error: "INSUFFICIENT_CONTENT", message: insufficientMsg });
      return;
    }

    // 4b. Build DNA with AI
    let dnaResult: any;

    if (hasAI()) {
      const primarySource = brandBrief.length > 100
        ? "Brand Brief (written by brand owner - treat this as the most authoritative source)"
        : scrapedLength > 400 ? "Scraped website/social content" : "Limited scraped content + brand brief";

      const contentQualityNote = `Primary source: ${primarySource}. Total content: ${totalContentLength} characters (${brandBrief.length} from brand brief, ${scrapedLength} from scraped sources). Extract ONLY what is explicitly supported by the provided content.`;

      const system = `You are a brand intelligence analyst. Return ONLY valid JSON. CRITICAL RULE: You must ONLY extract and reflect information that is explicitly present in the provided content. You must NEVER invent, assume, or infer a brand's personality, voice, or positioning that is not directly supported by the text you are given. The Brand Brief, if provided, is written directly by the brand owner and is the most reliable source - weight it heavily. If content is thin, say so honestly in brand_summary.`;

      const user = `Analyse this brand and return a Brand DNA JSON object.

${contentQualityNote}

Brand: ${brand.name}
Industry: ${brand.industry ?? "Unknown"}
Country: ${brand.country ?? "NG"} | Continent: ${brand.continent ?? "Africa"}
City: ${brand.city ?? "Unknown"}
Primary Language: ${brand.language ?? "English"}

Cultural Context for ${cultural.name}:
- Language notes: ${cultural.language_notes}
- Trust signals: ${cultural.trust_signals.join(", ")}
- Buying triggers: ${cultural.buying_triggers.join(", ")}
- Taboos to avoid: ${cultural.taboos.join(", ")}
- Key platforms: ${cultural.platforms.join(", ")}
- Payment references: ${cultural.payment_refs.join(", ")}
- Festive peaks: ${cultural.festive_peaks.join(", ")}

=== BRAND BRIEF (written by brand owner - highest authority) ===
${brandBrief || "Not provided."}

=== SCRAPED WEBSITE CONTENT (${websiteText.length} characters) ===
${websiteText || "EMPTY - no website content available."}

=== SCRAPED SOCIAL PROFILES (note: Instagram/TikTok/Twitter block scrapers so these are often empty) ===
${Object.entries(socialData).map(([p, t]) => `[${p.toUpperCase()}] (${t.length} chars): ${t || "Blocked by platform - not available"}`).join("\n\n")}

Return ONLY this JSON (no markdown fences, no explanation):
{
  "formality": <1-10, where 1=very casual, 10=very formal>,
  "energy": <1-10, where 1=calm/slow, 10=high energy/urgent>,
  "humor": <1-10, where 1=serious, 10=very funny>,
  "boldness": <1-10, where 1=conservative, 10=very bold>,
  "language_register": { "primary": "<language>", "markers": ["<exact phrases found in content>"], "avoid": ["<things to avoid based on content>"] },
  "content_themes": ["<theme explicitly found in content>"],
  "audience_profile": { "age_range": "<if determinable from content, else 'unknown'>", "gender": "<mix/male/female/unknown>", "income": "<level if determinable>", "interests": ["<interest from content>"], "pain_points": ["<pain from content>"] },
  "visual_identity": { "colors": ["<only if mentioned or visible>"], "style": "<only from content>", "mood": "<only from content>" },
  "cultural_context": { "primary_market": "<market>", "trust_signals": ${JSON.stringify(cultural.trust_signals)}, "buying_triggers": ${JSON.stringify(cultural.buying_triggers)}, "festive_peaks": ${JSON.stringify(cultural.festive_peaks)}, "taboos": ${JSON.stringify(cultural.taboos)}, "payment_refs": ${JSON.stringify(cultural.payment_refs)} },
  "power_words": ["<only words/phrases explicitly found in content>"],
  "taglines_found": ["<only actual taglines found - leave empty array if none found>"],
  "brand_summary": "<honest 2-3 sentence summary of what you could actually determine from the content. If content was limited, say so and describe what the brand appears to be based on available evidence only.>"
}`;

      dnaResult = await aiJSON(system, user, 500);
    } else {
      // Fallback DNA when no AI key is configured
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
          taboos: cultural.taboos,
          payment_refs: cultural.payment_refs,
        },
        power_words: ["authentic", "quality", "community", "trusted"],
        taglines_found: [],
        brand_summary: `${brand.name} is a ${brand.industry ?? "brand"} serving the ${cultural.name} market with authentic, community-focused products and services.`,
      };
    }

    // 5. Save to DB with build_status='complete'
    const dnaValues = {
      brandId: params.data.brandId,
      buildStatus: "complete",
      errorMessage: null,
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
    if (existing) {
      [dna] = await db.update(brandDnaTable).set(dnaValues).where(eq(brandDnaTable.brandId, params.data.brandId)).returning();
    } else {
      [dna] = await db.insert(brandDnaTable).values(dnaValues).returning();
    }

    await db.update(brandsTable).set({ dnaBuilt: true }).where(eq(brandsTable.id, params.data.brandId));

    // Auto-save detected brand assets (colors, logo) to visual prefs — only if not already set by user
    if (detectedAssets.logoUrl || detectedAssets.colors.length > 0) {
      try {
        const [existingPrefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, params.data.brandId));
        const newColors = existingPrefs?.brandColors?.length ? existingPrefs.brandColors : detectedAssets.colors;
        const newLogo = existingPrefs?.logoUrl ?? detectedAssets.logoUrl;
        if (existingPrefs) {
          await db.update(brandVisualPrefsTable)
            .set({ brandColors: newColors, logoUrl: newLogo, updatedAt: new Date() })
            .where(eq(brandVisualPrefsTable.brandId, params.data.brandId));
        } else {
          await db.insert(brandVisualPrefsTable).values({
            brandId: params.data.brandId,
            brandColors: newColors,
            logoUrl: newLogo,
            includeLogo: newLogo ? "always" : "ask",
          });
        }
      } catch (e) {
        console.warn("Could not auto-save brand assets:", e);
      }
    }

    res.json({ ...dna, dnaResult, detectedAssets });
  } catch (err: any) {
    const errorMessage = err?.message ?? "DNA build failed";
    console.error("DNA build error:", errorMessage);

    // When AI models are rate-limited, build a template DNA so the brand is still usable.
    // This is better than leaving the brand stuck with no DNA at all.
    if ((err as any)?.isRateLimit) {
      console.log("[DNA] Rate limit hit — using template fallback DNA for brand:", brand.name);
      try {
        const fallbackDna = {
          formality: 6, energy: 7, humor: 4, boldness: 7,
          language_register: { primary: brand.language ?? "English", markers: [], avoid: [] },
          content_themes: ["brand story", "product showcase", "community", "lifestyle"],
          audience_profile: { age_range: "25-45", gender: "mixed", income: "middle", interests: ["quality", "value"], pain_points: ["trust", "value for money"] },
          visual_identity: { colors: ["brand colors"], style: "modern", mood: "confident" },
          cultural_context: {
            primary_market: cultural.name,
            trust_signals: cultural.trust_signals,
            buying_triggers: cultural.buying_triggers,
            festive_peaks: cultural.festive_peaks,
            taboos: cultural.taboos,
            payment_refs: cultural.payment_refs,
          },
          power_words: ["authentic", "quality", "community", "trusted"],
          taglines_found: [],
          brand_summary: `${brand.name} is a ${brand.industry ?? "brand"} serving the ${cultural.name} market. DNA was auto-generated from a template — you can rebuild it later for AI-powered analysis.`,
        };
        const templateValues = {
          brandId: params.data.brandId,
          buildStatus: "complete",
          errorMessage: null,
          toneOfVoice: fallbackDna.brand_summary,
          coreValues: fallbackDna.power_words,
          targetAudience: JSON.stringify(fallbackDna.audience_profile),
          uniqueSellingPoints: fallbackDna.content_themes,
          culturalContext: JSON.stringify(fallbackDna.cultural_context),
          brandPersonality: `Formality: ${fallbackDna.formality}/10, Energy: ${fallbackDna.energy}/10, Boldness: ${fallbackDna.boldness}/10`,
          keyMessages: fallbackDna.taglines_found,
          writingStyle: JSON.stringify(fallbackDna.language_register),
          builtAt: new Date(),
        };
        let dna;
        if (existing) {
          [dna] = await db.update(brandDnaTable).set(templateValues).where(eq(brandDnaTable.brandId, params.data.brandId)).returning();
        } else {
          [dna] = await db.insert(brandDnaTable).values(templateValues).returning();
        }
        await db.update(brandsTable).set({ dnaBuilt: true }).where(eq(brandsTable.id, params.data.brandId));
        res.json({ ...dna, dnaResult: fallbackDna, isTemplateFallback: true });
      } catch (fallbackErr) {
        console.error("Failed to save template DNA:", fallbackErr);
        res.status(503).json({ error: "AI models are temporarily busy. Please try again in a few minutes." });
      }
      return;
    }

    // Non-rate-limit errors — save failed state
    try {
      const failedValues = {
        brandId: params.data.brandId,
        buildStatus: "failed",
        errorMessage,
        toneOfVoice: "",
        coreValues: [] as string[],
        targetAudience: "",
        uniqueSellingPoints: [] as string[],
        culturalContext: "",
        brandPersonality: "",
        keyMessages: [] as string[],
        writingStyle: "",
        builtAt: new Date(),
      };
      if (existing) {
        await db.update(brandDnaTable).set({ buildStatus: "failed", errorMessage }).where(eq(brandDnaTable.brandId, params.data.brandId));
      } else {
        await db.insert(brandDnaTable).values(failedValues);
      }
    } catch (dbErr) {
      console.error("Failed to save error status to DB:", dbErr);
    }

    res.status(500).json({ error: errorMessage });
  }
});

// ─── On-demand Brand Asset Detection ─────────────────────────────────────────
router.post("/brands/:brandId/detect-assets", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  if (!brand.websiteUrl) { res.status(400).json({ error: "Brand has no website URL set" }); return; }
  const assets = await crawlBrandAssets(brand.websiteUrl);
  res.json(assets);
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
