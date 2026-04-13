import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandVisualPrefsTable, generatedDesignsTable } from "@workspace/db";
import { aiJSON, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

// ─── Visual Prefs ─────────────────────────────────────────────────────────────

router.get("/brands/:brandId/visual-prefs", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  if (!prefs) { res.status(404).json({ error: "Not found" }); return; }
  res.json(prefs);
});

router.post("/brands/:brandId/visual-prefs", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { includeLogo, logoUrl, brandColors, designStyle } = req.body;
  const existing = await db.select({ id: brandVisualPrefsTable.id }).from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  if (existing.length > 0) {
    const [updated] = await db.update(brandVisualPrefsTable)
      .set({ includeLogo, logoUrl, brandColors, designStyle, updatedAt: new Date() })
      .where(eq(brandVisualPrefsTable.brandId, brandId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(brandVisualPrefsTable).values({ brandId, includeLogo, logoUrl, brandColors, designStyle }).returning();
    res.status(201).json(created);
  }
});

// ─── Carousel Generation ──────────────────────────────────────────────────────

router.post("/generate/carousel", async (req, res): Promise<void> => {
  const { brandId, topic, slideCount = 5, platform = "instagram", includeLogo } = req.body;
  if (!brandId || !topic) { res.status(400).json({ error: "brandId and topic required" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const style = prefs?.designStyle ?? "professional";

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = `You are a social media content strategist for African businesses.
Design high-quality carousel post copy for ${platform}.
Return ONLY valid JSON. No explanation, no markdown.`;

    const user = `Create a ${slideCount}-slide carousel for ${brand.name} about: "${topic}"
Brand: ${brand.name} | Industry: ${brand.industry ?? "General"} | Style: ${style}
Platform: ${platform}

Return JSON:
{
  "title": "carousel title",
  "slides": [
    {
      "slide_number": 1,
      "headline": "short punchy headline (max 8 words)",
      "body": "2-3 sentence supporting text",
      "cta": "optional call to action (last slide only)"
    }
  ]
}

Rules: First slide is the hook - make it impossible to scroll past. Last slide has a clear CTA. Keep brand: ${brand.name}.`;

    const result = await aiJSON<{ title: string; slides: Array<{ slide_number: number; headline: string; body: string; cta?: string }> }>(system, user, 500);

    const slides = result.slides.map((slide, i) => ({
      ...slide,
      html: buildSlideHtml({ ...slide, brandName: brand.name, colors, style, slideNumber: i + 1, total: result.slides.length }),
    }));

    const [saved] = await db.insert(generatedDesignsTable).values({
      brandId,
      userId: (req as any).user?.id ?? brandId,
      designType: "carousel",
      platform,
      title: result.title,
      slides: slides as any,
      promptUsed: topic,
    }).returning();

    res.json({ ...saved, slides });
  } catch (err: any) {
    if (err.message === "no-ai") {
      res.status(503).json({ error: "AI unavailable" });
    } else {
      console.error("Carousel error:", err);
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── Quote Card Generation ─────────────────────────────────────────────────────

router.post("/generate/quote-card", async (req, res): Promise<void> => {
  const { brandId, quoteText, attribution, backgroundStyle = "solid", format = "square" } = req.body;
  if (!brandId || !quoteText) { res.status(400).json({ error: "brandId and quoteText required" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];

  const html = buildQuoteCardHtml({ quoteText, attribution, brandName: brand.name, colors, backgroundStyle, format });

  const [saved] = await db.insert(generatedDesignsTable).values({
    brandId,
    userId: (req as any).user?.id ?? brandId,
    designType: "quote_card",
    platform: "all",
    title: quoteText.slice(0, 60),
    slides: [{ html, quoteText, attribution }] as any,
    promptUsed: quoteText,
  }).returning();

  res.json({ ...saved, html });
});

// ─── HTML builders ────────────────────────────────────────────────────────────

function buildSlideHtml({ headline, body, cta, brandName, colors, style, slideNumber, total }: {
  headline: string; body: string; cta?: string; brandName: string;
  colors: string[]; style: string; slideNumber: number; total: number;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const isDark = style === "dark" || style === "premium";
  const bgColor = isDark ? "#0F0F0F" : bg;
  const textColor = isDark ? "#FFFFFF" : text;

  return `<div style="width:1080px;height:1080px;background:${bgColor};display:flex;flex-direction:column;justify-content:space-between;padding:80px;font-family:'Inter',sans-serif;box-sizing:border-box;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;left:0;width:12px;height:100%;background:${primary};"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-left:20px;">
    <span style="color:${primary};font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>
    <span style="color:${textColor}80;font-size:16px;">${slideNumber} / ${total}</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;margin:40px 20px;">
    <h2 style="color:${textColor};font-size:${headline.length > 40 ? '52px' : '64px'};font-weight:800;line-height:1.15;margin:0 0 32px 0;letter-spacing:-1px;">${headline}</h2>
    <p style="color:${textColor}CC;font-size:26px;line-height:1.6;margin:0;">${body}</p>
    ${cta ? `<div style="margin-top:40px;padding:16px 32px;background:${primary};display:inline-block;border-radius:8px;color:#FFFFFF;font-size:22px;font-weight:700;">${cta}</div>` : ""}
  </div>
  <div style="height:4px;background:${primary}30;border-radius:2px;margin-left:20px;">
    <div style="height:4px;width:${(slideNumber / total) * 100}%;background:${primary};border-radius:2px;"></div>
  </div>
</div>`;
}

function buildQuoteCardHtml({ quoteText, attribution, brandName, colors, backgroundStyle, format }: {
  quoteText: string; attribution?: string; brandName: string; colors: string[];
  backgroundStyle: string; format: string;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const gradientBg = backgroundStyle === "gradient"
    ? `background:linear-gradient(135deg, ${bg} 0%, ${primary}66 100%)`
    : `background:${bg}`;

  return `<div style="${dims};${gradientBg};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:100px;font-family:'Inter',sans-serif;box-sizing:border-box;text-align:center;">
  <div style="font-size:120px;color:${primary};line-height:0.5;margin-bottom:40px;opacity:0.4;">"</div>
  <p style="color:${text};font-size:${quoteText.length > 100 ? '40px' : '52px'};font-weight:700;line-height:1.4;margin:0 0 48px 0;letter-spacing:-0.5px;">${quoteText}</p>
  ${attribution ? `<p style="color:${text}80;font-size:24px;font-weight:500;margin:0 0 16px 0;">- ${attribution}</p>` : ""}
  <div style="width:60px;height:3px;background:${primary};border-radius:2px;margin:16px 0;"></div>
  <p style="color:${primary};font-size:20px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0;">${brandName}</p>
</div>`;
}

export default router;
