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

// Strip em dashes from any string recursively (safety net)
function stripEmDashes<T>(val: T): T {
  if (typeof val === "string") return val.replace(/\u2014/g, " - ") as unknown as T;
  if (Array.isArray(val)) return val.map(stripEmDashes) as unknown as T;
  if (val && typeof val === "object") {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, stripEmDashes(v)])) as unknown as T;
  }
  return val;
}

router.post("/generate/carousel", async (req, res): Promise<void> => {
  const { brandId, topic, slideCount = 5, platform = "instagram", showBrandName = true, logoUrl: reqLogoUrl } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const style = prefs?.designStyle ?? "professional";

  try {
    if (!hasAI()) throw new Error("no-ai");

    const system = `You are a social media content strategist for African businesses.
Design high-quality carousel post copy for ${platform}.
NEVER use the em dash character \u2014 (—). This character is completely banned. Use a hyphen (-) or rewrite sentences instead.
Return ONLY valid JSON. No explanation, no markdown.`;

    const topicLine = topic?.trim()
      ? `Topic: "${topic.trim()}"`
      : `No topic specified. Choose a highly relevant topic for ${brand.name} (${brand.industry ?? "General"}) that would perform well on ${platform} right now.`;

    const user = `Create a ${slideCount}-slide carousel for ${brand.name}.
${topicLine}
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

Rules: First slide is the hook - make it impossible to scroll past. Last slide has a clear CTA. NEVER use the em dash character \u2014 (—).`;

    const result = await aiJSON<{ title: string; slides: Array<{ slide_number: number; headline: string; body: string; cta?: string }> }>(system, user, 500);

    const logoUrl = reqLogoUrl ?? prefs?.logoUrl ?? null;
    const cleanResult = stripEmDashes(result);
    const slides = cleanResult.slides.map((slide, i) => ({
      ...slide,
      html: buildSlideHtml({ ...slide, brandName: brand.name, colors, style, slideNumber: i + 1, total: cleanResult.slides.length, showBrandName, logoUrl }),
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
  const { brandId, quoteText, attribution, backgroundStyle = "solid", format = "square", showBrandName = true } = req.body;
  if (!brandId || !quoteText) { res.status(400).json({ error: "brandId and quoteText required" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;

  const html = buildQuoteCardHtml({ quoteText, attribution, brandName: brand.name, colors, backgroundStyle, format, showBrandName, logoUrl });

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

function buildSlideHtml({ headline, body, cta, brandName, colors, style, slideNumber, total, showBrandName = true, logoUrl }: {
  headline: string; body: string; cta?: string; brandName: string;
  colors: string[]; style: string; slideNumber: number; total: number; showBrandName?: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const bgColor = bg;
  const textColor = text;
  const hs = headline.length > 45 ? 50 : headline.length > 30 ? 62 : 72;
  const isFirst = slideNumber === 1;
  const isLast = slideNumber === total;

  let brandTag = "";
  if (showBrandName) {
    brandTag = logoUrl
      ? `<img src="${logoUrl}" alt="${brandName}" style="height:38px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`
      : `<span style="color:${primary};font-size:17px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>`;
  }

  const accentBar = `<div style="position:absolute;left:0;top:0;bottom:0;width:22px;background:linear-gradient(180deg,${primary} 0%,${primary}88 100%);"></div>`;
  const bgCircle = isFirst
    ? `<div style="position:absolute;top:-160px;right:-160px;width:560px;height:560px;border-radius:50%;background:${primary};opacity:0.10;"></div>`
    : `<div style="position:absolute;bottom:-120px;right:-120px;width:420px;height:420px;border-radius:50%;background:${primary};opacity:0.08;"></div>`;

  const progressDots = Array.from({ length: total }, (_, i) =>
    `<div style="width:${i === slideNumber - 1 ? '32px' : '10px'};height:10px;border-radius:5px;background:${i === slideNumber - 1 ? primary : text + '30'};transition:all 0.3s;"></div>`
  ).join("");

  return `<div style="width:1080px;height:1080px;background:${bgColor};display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;box-sizing:border-box;position:relative;overflow:hidden;">
  ${accentBar}
  ${bgCircle}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:60px 64px 0 88px;position:relative;">
    ${brandTag || "<span></span>"}
    <div style="padding:10px 24px;background:${primary}22;border:1.5px solid ${primary}55;border-radius:100px;">
      <span style="color:${primary};font-size:16px;font-weight:700;">${slideNumber} of ${total}</span>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 64px 40px 88px;position:relative;gap:30px;">
    ${isFirst ? `<div style="display:inline-flex;align-items:center;gap:10px;padding:8px 20px;background:${primary};border-radius:100px;width:fit-content;margin-bottom:4px;"><span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">START HERE</span></div>` : ""}
    <h2 style="color:${textColor};font-size:${hs}px;font-weight:900;line-height:1.12;margin:0;letter-spacing:-1.5px;">${headline}</h2>
    <p style="color:${textColor}CC;font-size:26px;line-height:1.65;margin:0;max-width:860px;">${body}</p>
    ${cta ? `<div style="margin-top:8px;padding:20px 44px;background:${primary};display:inline-block;border-radius:14px;"><span style="color:#fff;font-size:22px;font-weight:700;">${cta} &#8594;</span></div>` : ""}
  </div>
  <div style="padding:0 64px 52px 88px;display:flex;align-items:center;gap:8px;position:relative;">
    ${progressDots}
  </div>
</div>`;
}

function buildQuoteCardHtml({ quoteText, attribution, brandName, colors, backgroundStyle, format, showBrandName = true, logoUrl }: {
  quoteText: string; attribution?: string; brandName: string; colors: string[];
  backgroundStyle: string; format: string; showBrandName?: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const gradientBg = backgroundStyle === "gradient"
    ? `background:linear-gradient(145deg,${bg} 0%,${bg} 55%,${primary}44 100%)`
    : backgroundStyle === "brand"
    ? `background:${primary}`
    : `background:${bg}`;
  const textOnBrand = backgroundStyle === "brand" ? "#fff" : text;

  let brandBlock = "";
  if (showBrandName) {
    if (logoUrl) {
      brandBlock = `<img src="${logoUrl}" alt="${brandName}" style="height:38px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`;
    } else {
      brandBlock = `<span style="color:${backgroundStyle === "brand" ? "#fff" : primary};font-size:17px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>`;
    }
  }

  const qs = quoteText.length > 140 ? 34 : quoteText.length > 80 ? 42 : 50;
  const accentOnBrand = backgroundStyle === "brand" ? "#fff" : primary;
  const circleOpacity = backgroundStyle === "brand" ? "0.15" : "0.12";
  return `<div style="${dims};${gradientBg};display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="position:absolute;top:-180px;right:-180px;width:600px;height:600px;border-radius:50%;background:${accentOnBrand};opacity:${circleOpacity};"></div>
  <div style="position:absolute;bottom:-100px;left:-100px;width:380px;height:380px;border-radius:50%;background:${accentOnBrand};opacity:${circleOpacity};"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:${accentOnBrand};opacity:0.9;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 60px 108px;position:relative;gap:32px;">
    <div style="font-size:160px;color:${accentOnBrand};line-height:0.55;font-family:Georgia,serif;opacity:0.35;">"</div>
    <p style="color:${textOnBrand};font-size:${qs}px;font-weight:700;line-height:1.45;margin:0;letter-spacing:-0.5px;">${quoteText}"</p>
    ${attribution ? `<div style="display:flex;align-items:center;gap:16px;margin-top:8px;">
      <div style="width:40px;height:3px;background:${accentOnBrand};border-radius:2px;opacity:0.7;"></div>
      <p style="color:${textOnBrand}99;font-size:22px;font-weight:600;margin:0;">${attribution}</p>
    </div>` : ""}
  </div>
  ${brandBlock ? `<div style="padding:32px 80px 56px 108px;position:relative;display:flex;align-items:center;">${brandBlock}</div>` : ""}
</div>`;
}

// ─── Shared brand mark helper ─────────────────────────────────────────────────
function brandMark({ showBrandName, logoUrl, brandName, primary, dark = true }: {
  showBrandName: boolean; logoUrl?: string | null; brandName: string; primary: string; dark?: boolean;
}): string {
  if (!showBrandName) return "";
  if (logoUrl) {
    const f = dark ? "filter:brightness(0) invert(1);" : "";
    return `<img src="${logoUrl}" alt="${brandName}" style="height:36px;max-width:160px;object-fit:contain;${f}" />`;
  }
  return `<span style="color:${primary};font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>`;
}

// ─── Announcement ─────────────────────────────────────────────────────────────
router.post("/generate/announcement", async (req, res): Promise<void> => {
  const { brandId, eventDetails, ctaText, format = "square", showBrandName = true } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;

  let headline = "Big News!", subtext = eventDetails || "Stay tuned for something exciting.", cta = ctaText || "Learn More";
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a brand copywriter for African businesses.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}.
Event/Announcement details: ${eventDetails || "General announcement - make something exciting"}

Generate announcement copy. Return JSON: { "headline": string (max 8 words, punchy), "subtext": string (max 20 words, supporting detail), "cta": string (max 4 words) }
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.subtext) subtext = result.subtext;
      if (result.cta) cta = ctaText || result.cta;
    }
  } catch { }

  const html = buildAnnouncementHtml({ headline, subtext, cta, brandName: brand.name, colors, format, showBrandName, logoUrl });
  res.json({ html, headline, subtext, cta });
});

function buildAnnouncementHtml({ headline, subtext, cta, brandName, colors, format, showBrandName, logoUrl }: {
  headline: string; subtext: string; cta: string; brandName: string; colors: string[];
  format: string; showBrandName: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const w = 1080;
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  const hs = headline.length > 38 ? 60 : headline.length > 24 ? 72 : 86;

  const diagSvg = `<svg style="position:absolute;top:0;left:0;width:${w}px;height:${h}px;pointer-events:none;" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polygon points="0,0 520,0 0,${Math.round(h * 0.42)}" fill="${primary}" opacity="0.20"/>
    <polygon points="0,0 260,0 0,${Math.round(h * 0.22)}" fill="${primary}" opacity="0.18"/>
  </svg>`;

  return `<div style="${dims};background:${bg};display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  ${diagSvg}
  <div style="position:absolute;bottom:-200px;right:-200px;width:640px;height:640px;border-radius:50%;border:2px solid ${primary};opacity:0.14;"></div>
  <div style="position:absolute;bottom:-100px;right:-100px;width:380px;height:380px;border-radius:50%;background:${primary};opacity:0.09;"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:20px;background:${primary};"></div>
  <div style="padding:64px 64px 0 96px;display:flex;justify-content:space-between;align-items:center;position:relative;">
    ${bm || "<span></span>"}
    <div style="padding:10px 24px;border:2px solid ${primary};border-radius:100px;">
      <span style="color:${primary};font-size:16px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Announcement</span>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:48px 80px 48px 96px;position:relative;gap:32px;">
    <h1 style="color:${text};font-size:${hs}px;font-weight:900;line-height:1.08;margin:0;letter-spacing:-2px;">${headline}</h1>
    <p style="color:${text}BB;font-size:27px;line-height:1.7;margin:0;max-width:840px;">${subtext}</p>
    <div style="padding:22px 48px;background:${primary};border-radius:16px;display:inline-block;margin-top:8px;">
      <span style="color:#fff;font-size:23px;font-weight:700;">${cta} &#8594;</span>
    </div>
  </div>
</div>`;
}

// ─── Product Showcase ─────────────────────────────────────────────────────────
router.post("/generate/product-showcase", async (req, res): Promise<void> => {
  const { brandId, productName, productDescription, price, ctaText, format = "square", showBrandName = true } = req.body;
  if (!brandId || !productName) { res.status(400).json({ error: "brandId and productName required" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;

  let headline = `Introducing ${productName}`, tagline = productDescription || "Premium quality, made for you.";
  let cta = ctaText || "Shop Now";
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a product marketer for African brands.
Brand: ${brand.name}. Product: ${productName}. ${productDescription ? `Description: ${productDescription}` : ""}
${price ? `Price: ${price}` : ""}

Write product showcase copy. Return JSON: { "headline": string (punchy hook, max 8 words), "tagline": string (value prop, max 12 words), "cta": string (max 3 words) }
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.tagline) tagline = result.tagline;
      if (result.cta) cta = ctaText || result.cta;
    }
  } catch { }

  const html = buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName: brand.name, colors, format, showBrandName, logoUrl });
  res.json({ html, headline, tagline, cta });
});

function buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName, colors, format, showBrandName, logoUrl }: {
  productName: string; headline: string; tagline: string; price?: string; cta: string;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const hs = headline.length > 35 ? 54 : headline.length > 22 ? 66 : 78;
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: false });
  const bmDark = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });

  return `<div style="${dims};background:${bg};display:flex;flex-direction:row;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="width:340px;flex-shrink:0;background:${primary};display:flex;flex-direction:column;justify-content:space-between;padding:64px 48px;position:relative;overflow:hidden;">
    <div style="position:absolute;bottom:-80px;left:-80px;width:320px;height:320px;border-radius:50%;background:#fff;opacity:0.08;"></div>
    <div style="position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:#fff;opacity:0.08;"></div>
    <div>
      ${bm || ""}
    </div>
    <div style="position:relative;">
      <p style="color:#fff;font-size:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin:0 0 20px 0;opacity:0.7;">PRODUCT</p>
      <p style="color:#fff;font-size:32px;font-weight:900;line-height:1.2;margin:0;letter-spacing:-0.5px;">${productName}</p>
      ${price ? `<div style="margin-top:28px;padding:14px 24px;background:#fff;border-radius:12px;display:inline-block;">
        <span style="color:${primary};font-size:26px;font-weight:900;">${price}</span>
      </div>` : ""}
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-140px;right:-140px;width:460px;height:460px;border-radius:50%;background:${primary};opacity:0.07;"></div>
    <div style="display:flex;justify-content:flex-end;position:relative;">
      ${bmDark || ""}
    </div>
    <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;padding:32px 0;">
      <div style="width:52px;height:5px;background:${primary};border-radius:3px;"></div>
      <h1 style="color:${text};font-size:${hs}px;font-weight:900;line-height:1.1;margin:0;letter-spacing:-1.5px;">${headline}</h1>
      <p style="color:${text}99;font-size:24px;line-height:1.6;margin:0;">${tagline}</p>
    </div>
    <div style="position:relative;">
      <div style="padding:20px 44px;background:${primary};border-radius:14px;display:inline-block;">
        <span style="color:#fff;font-size:22px;font-weight:700;">${cta} &#8594;</span>
      </div>
    </div>
  </div>
</div>`;
}

// ─── Story Cover ──────────────────────────────────────────────────────────────
router.post("/generate/story-cover", async (req, res): Promise<void> => {
  const { brandId, topic, mood = "bold", showBrandName = true } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;

  let hookText = topic || "Swipe to see more", subText = "Tap to open";
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a social media strategist for African brands.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}.
Mood: ${mood}. ${topic ? `Topic: ${topic}` : "Generate a compelling hook"}

Write an Instagram/TikTok story cover. Return JSON: { "hookText": string (bold hook, max 6 words, all caps works great), "subText": string (call to action, max 5 words) }
Never use em dashes.`, "{}");
      if (result.hookText) hookText = result.hookText;
      if (result.subText) subText = result.subText;
    }
  } catch { }

  const html = buildStoryCoverHtml({ hookText, subText, brandName: brand.name, colors, mood, showBrandName, logoUrl });
  res.json({ html, hookText, subText });
});

function buildStoryCoverHtml({ hookText, subText, brandName, colors, mood, showBrandName, logoUrl }: {
  hookText: string; subText: string; brandName: string; colors: string[];
  mood: string; showBrandName: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const bgStyle = mood === "minimal"
    ? `background:${text};`
    : mood === "gradient"
    ? `background:linear-gradient(160deg, ${bg} 0%, ${primary}CC 100%);`
    : `background:${bg};`;
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  return `<div style="width:1080px;height:1920px;${bgStyle}display:flex;flex-direction:column;font-family:'Inter',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 70%, ${primary}33 0%, transparent 60%);"></div>
  ${bm ? `<div style="padding:80px;position:relative;">${bm}</div>` : `<div style="height:80px;"></div>`}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px;position:relative;">
    <div style="width:80px;height:8px;background:${primary};border-radius:4px;margin-bottom:48px;"></div>
    <h1 style="color:${text};font-size:${hookText.length > 20 ? '100px' : '130px'};font-weight:900;line-height:1.0;margin:0;letter-spacing:-3px;text-transform:uppercase;">${hookText}</h1>
  </div>
  <div style="padding:60px 80px 120px;position:relative;display:flex;align-items:center;gap:20px;">
    <div style="width:40px;height:40px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:20px;">&#9654;</span>
    </div>
    <span style="color:${text}AA;font-size:24px;font-weight:500;">${subText}</span>
  </div>
</div>`;
}

// ─── Birthday Post ────────────────────────────────────────────────────────────
router.post("/generate/birthday-post", async (req, res): Promise<void> => {
  const { brandId, personName, personRole, shortMessage, showBrandName = true } = req.body;
  if (!brandId || !personName) { res.status(400).json({ error: "brandId and personName required" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;

  let message = shortMessage || `Wishing you a wonderful birthday filled with joy and laughter!`;
  try {
    if (hasAI() && !shortMessage) {
      const result = await aiJSON(`You are a warm copywriter for an African business.
Brand: ${brand.name}. We are celebrating ${personName}${personRole ? `, our ${personRole}` : ""}.

Write a heartfelt birthday message. Return JSON: { "message": string (2 sentences, warm and celebratory, brand-appropriate) }
Never use em dashes.`, "{}");
      if (result.message) message = result.message;
    }
  } catch { }

  const html = buildBirthdayPostHtml({ personName, personRole, message, brandName: brand.name, colors, showBrandName, logoUrl });
  res.json({ html, message });
});

function buildBirthdayPostHtml({ personName, personRole, message, brandName, colors, showBrandName, logoUrl }: {
  personName: string; personRole?: string; message: string;
  brandName: string; colors: string[]; showBrandName: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  const dots = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360; const r = 480;
    const x = 540 + r * Math.cos((angle * Math.PI) / 180);
    const y = 540 + r * Math.sin((angle * Math.PI) / 180);
    return `<circle cx="${x}" cy="${y}" r="8" fill="${primary}" opacity="${0.3 + (i % 3) * 0.2}" />`;
  }).join("");
  return `<div style="width:1080px;height:1080px;background:${bg};display:flex;flex-direction:column;font-family:'Inter',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.4;" viewBox="0 0 1080 1080">${dots}</svg>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:80px;text-align:center;gap:28px;position:relative;">
    <div style="font-size:80px;line-height:1;">&#127881;</div>
    <div>
      <p style="color:${primary};font-size:22px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin:0 0 16px 0;">Happy Birthday</p>
      <h1 style="color:${text};font-size:${personName.length > 12 ? '72px' : '96px'};font-weight:900;line-height:1.0;margin:0;letter-spacing:-2px;">${personName}</h1>
      ${personRole ? `<p style="color:${primary};font-size:22px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:16px 0 0 0;">${personRole}</p>` : ""}
    </div>
    <div style="width:80px;height:3px;background:${primary};border-radius:2px;"></div>
    <p style="color:${text}CC;font-size:26px;line-height:1.6;margin:0;max-width:800px;">${message}</p>
  </div>
  ${bm ? `<div style="padding:40px;display:flex;justify-content:center;position:relative;">${bm}</div>` : ""}
</div>`;
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────
router.post("/generate/testimonial", async (req, res): Promise<void> => {
  const { brandId, testimonialText, customerName, customerRole, rating = 5, format = "square", showBrandName = true } = req.body;
  if (!brandId || !testimonialText) { res.status(400).json({ error: "brandId and testimonialText required" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const [prefs] = await db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId));
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const html = buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName: brand.name, colors, format, showBrandName, logoUrl });
  res.json({ html });
});

function buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName, colors, format, showBrandName, logoUrl }: {
  testimonialText: string; customerName?: string; customerRole?: string; rating: number;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const stars = Array.from({ length: 5 }, (_, i) => `<span style="color:${i < rating ? primary : text + '33'};font-size:36px;">&#9733;</span>`).join("");
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  const initials = customerName ? customerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  return `<div style="${dims};background:${bg};display:flex;flex-direction:column;justify-content:center;font-family:'Inter',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="position:absolute;top:0;left:0;width:100%;height:6px;background:${primary};"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:100px;gap:32px;">
    <div style="display:flex;gap:4px;">${stars}</div>
    <div style="font-size:100px;color:${primary};line-height:0.6;opacity:0.3;font-family:Georgia,serif;">"</div>
    <p style="color:${text};font-size:${testimonialText.length > 120 ? '32px' : '40px'};font-weight:600;line-height:1.5;margin:0;">${testimonialText}"</p>
    ${customerName ? `<div style="display:flex;align-items:center;gap:20px;margin-top:8px;">
      <div style="width:60px;height:60px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:#fff;font-size:22px;font-weight:700;">${initials}</span>
      </div>
      <div>
        <p style="color:${text};font-size:24px;font-weight:700;margin:0;">${customerName}</p>
        ${customerRole ? `<p style="color:${text}77;font-size:20px;margin:4px 0 0 0;">${customerRole}</p>` : ""}
      </div>
    </div>` : ""}
  </div>
  ${bm ? `<div style="padding:40px 100px;border-top:1px solid ${text}11;">${bm}</div>` : ""}
</div>`;
}

export default router;
