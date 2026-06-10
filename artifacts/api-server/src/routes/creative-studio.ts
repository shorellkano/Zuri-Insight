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
    return `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:36px;max-width:160px;object-fit:contain;${f}" />`;
  }
  return `<span style="color:${primary};font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>`;
}

// ─── Photo background helpers ──────────────────────────────────────────────────
// Resolves an Unsplash source URL to a direct CDN URL so html2canvas can use it
// without CORS redirect issues.
async function resolvePhotoUrl(query: string, w: number, h: number): Promise<string> {
  const q = query.trim().replace(/\s+/g, ",");
  const sourceUrl = `https://source.unsplash.com/featured/${w}x${h}/?${encodeURIComponent(q)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(sourceUrl, { redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    const finalUrl = resp.url;
    if (finalUrl && finalUrl.includes("images.unsplash.com")) return finalUrl;
  } catch { /* fallthrough to source URL */ }
  return sourceUrl;
}

const INDUSTRY_PHOTO_QUERIES: Record<string, string> = {
  "Food & Beverage": "african restaurant food dining table",
  "Health & Wellness": "wellness fitness healthy african woman",
  "Healthcare & Medical": "medical professional clinic healthcare african",
  "Beauty & Personal Care": "beauty salon skincare african woman cosmetics",
  "Fashion & Apparel": "fashion boutique style african clothing",
  "Technology & SaaS": "modern office technology professional business",
  "Real Estate & Property": "luxury property modern architecture interior",
  "Education & Training": "education classroom students learning",
  "Domestic Staffing & Caregiving": "home care professional caregiver indoor",
  "Entertainment & Events": "event celebration party crowd",
  "Travel & Hospitality": "hotel hospitality luxury travel",
  "Church & Religious Organisation": "church community gathering",
  "Agriculture & Farming": "farming agriculture green fields africa",
  "Fintech & Payments": "finance mobile payment business professional",
  "Logistics & Courier": "logistics delivery professional vehicle",
  "Retail & E-commerce": "retail shopping boutique products store",
  "Construction & Engineering": "construction engineering modern building",
  "Non-profit & NGO": "community africa people volunteers",
};

function industryPhotoQuery(industry: string | null | undefined, context = ""): string {
  const base = INDUSTRY_PHOTO_QUERIES[industry ?? ""] ?? "african business professional modern";
  return context ? `${base} ${context}` : base;
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

  let headline = "BIG NEWS IS HERE", subtext = eventDetails || "Stay tuned for something exciting.", cta = ctaText || "Learn More";
  let imageQuery = industryPhotoQuery(brand.industry, "announcement launch event outdoor");
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a brand copywriter for African businesses.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}.
Event/Announcement details: ${eventDetails || "General announcement — make something exciting"}

Generate announcement copy. Return JSON:
{
  "headline": "string (max 8 words, punchy, ALL CAPS friendly)",
  "subtext": "string (max 18 words, supporting detail)",
  "cta": "string (max 4 words)",
  "imageQuery": "string (5-8 keywords for a relevant Unsplash stock photo — describe scene not text)"
}
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.subtext) subtext = result.subtext;
      if (result.cta) cta = ctaText || result.cta;
      if (result.imageQuery) imageQuery = result.imageQuery;
    }
  } catch { }

  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const photoUrl = await resolvePhotoUrl(imageQuery, w, h);
  const html = buildAnnouncementHtml({ headline, subtext, cta, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl });
  res.json({ html, headline, subtext, cta });
});

function buildAnnouncementHtml({ headline, subtext, cta, brandName, colors, format, showBrandName, logoUrl, photoUrl }: {
  headline: string; subtext: string; cta: string; brandName: string; colors: string[];
  format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
}) {
  const [primary, secondary] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const hs = headline.length > 40 ? 72 : headline.length > 22 ? 90 : 108;
  const barPad = h >= 1900 ? 36 : 28;
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:54px;max-width:200px;object-fit:contain;filter:brightness(0) invert(1);flex-shrink:0;" />`
    : `<div style="width:54px;height:54px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#fff;font-size:24px;font-weight:900;">${brandName.slice(0,1)}</span></div>`;
  return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.15) 45%,rgba(0,0,0,0.0) 70%);"></div>
  <div style="position:absolute;top:64px;left:64px;right:64px;">
    <h1 style="font-family:'Arial Black','Impact',system-ui,sans-serif;font-size:${hs}px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:1.05;margin:0;text-shadow:2px 4px 24px rgba(0,0,0,0.6);">${headline}</h1>
    ${subtext ? `<p style="font-size:${h >= 1900 ? 34 : 27}px;font-weight:500;color:#ffffffCC;margin:${h >= 1900 ? 32 : 22}px 0 0;line-height:1.5;text-shadow:1px 2px 10px rgba(0,0,0,0.5);max-width:840px;">${subtext}</p>` : ""}
  </div>
  ${showBrandName ? `<div style="position:absolute;bottom:0;left:0;right:0;background:${secondary};padding:${barPad}px 52px;display:flex;align-items:center;gap:22px;">
    ${logoEl}
    <div>
      <p style="font-size:${h >= 1900 ? 28 : 22}px;font-weight:700;color:#ffffff;margin:0;">${brandName}</p>
      ${cta ? `<p style="font-size:${h >= 1900 ? 22 : 18}px;font-weight:500;color:#ffffffCC;margin:4px 0 0;">${cta}</p>` : ""}
    </div>
  </div>` : ""}
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
  let imageQuery = industryPhotoQuery(brand.industry, `${productName} product lifestyle`);
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a product marketer for African brands.
Brand: ${brand.name}. Product: ${productName}. ${productDescription ? `Description: ${productDescription}` : ""}
${price ? `Price: ${price}` : ""}

Write product showcase copy. Return JSON:
{
  "headline": "string (punchy hook, max 8 words)",
  "tagline": "string (value prop, max 12 words)",
  "cta": "string (max 3 words)",
  "imageQuery": "string (5-8 keywords for a relevant Unsplash lifestyle or product photo)"
}
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.tagline) tagline = result.tagline;
      if (result.cta) cta = ctaText || result.cta;
      if (result.imageQuery) imageQuery = result.imageQuery;
    }
  } catch { }

  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const photoUrl = await resolvePhotoUrl(imageQuery, w, h);
  const html = buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl });
  res.json({ html, headline, tagline, cta });
});

function buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName, colors, format, showBrandName, logoUrl, photoUrl }: {
  productName: string; headline: string; tagline: string; price?: string; cta: string;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
}) {
  const [primary, secondary] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const cardH = Math.round(h * 0.40);
  const hs = headline.length > 35 ? 52 : headline.length > 22 ? 64 : 76;
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:38px;max-width:160px;object-fit:contain;margin-bottom:10px;display:block;" />`
    : `<span style="font-size:14px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${primary};margin-bottom:10px;display:block;">${brandName}</span>`;

  return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;background:#f5f5f5;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:${h - cardH + 80}px;object-fit:cover;object-position:center top;" />
  <div style="position:absolute;top:0;left:0;right:0;height:${h - cardH + 80}px;background:linear-gradient(to bottom,rgba(0,0,0,0) 35%,rgba(0,0,0,0.15) 65%,rgba(245,245,245,1) 100%);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:${cardH}px;background:#ffffff;border-radius:28px 28px 0 0;padding:${Math.round(cardH * 0.10)}px 52px ${Math.round(cardH * 0.12)}px;border-top:8px solid ${primary};">
    ${showBrandName ? logoEl : ""}
    <h1 style="font-size:${hs}px;font-weight:900;color:${secondary};margin:0 0 10px;line-height:1.1;letter-spacing:-1px;">${headline}</h1>
    <p style="font-size:22px;color:#555;margin:0 0 18px;line-height:1.5;">${tagline}</p>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      ${price ? `<div style="padding:10px 24px;background:${primary}1A;border:2px solid ${primary};border-radius:100px;"><span style="font-size:22px;font-weight:900;color:${primary};">${price}</span></div>` : ""}
      <div style="padding:14px 36px;background:${primary};border-radius:100px;flex:1;text-align:center;min-width:160px;"><span style="font-size:20px;font-weight:700;color:#fff;">${cta} &#8594;</span></div>
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

  let hookText = "SWIPE FOR MORE", subText = "Tap to open";
  let imageQuery = industryPhotoQuery(brand.industry, "lifestyle portrait vertical");
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a social media strategist for African brands.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}.
Mood: ${mood}. ${topic ? `Topic: ${topic}` : "Generate a compelling hook"}

Write an Instagram/TikTok story cover. Return JSON:
{
  "hookText": "string (bold hook, max 6 words, ALL CAPS format works great)",
  "subText": "string (call to action, max 5 words)",
  "imageQuery": "string (5-8 keywords for a Unsplash vertical/portrait photo)"
}
Never use em dashes.`, "{}");
      if (result.hookText) hookText = result.hookText;
      if (result.subText) subText = result.subText;
      if (result.imageQuery) imageQuery = result.imageQuery;
    }
  } catch { }

  const photoUrl = await resolvePhotoUrl(imageQuery, 1080, 1920);
  const html = buildStoryCoverHtml({ hookText, subText, brandName: brand.name, colors, mood, showBrandName, logoUrl, photoUrl });
  res.json({ html, hookText, subText });
});

function buildStoryCoverHtml({ hookText, subText, brandName, colors, mood, showBrandName, logoUrl, photoUrl }: {
  hookText: string; subText: string; brandName: string; colors: string[];
  mood: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
}) {
  const [primary] = [colors[0] ?? "#D97706"];
  const hs = hookText.length > 22 ? 100 : hookText.length > 12 ? 120 : 144;
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:44px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:18px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;">${brandName}</span>`;

  return `<div style="width:1080px;height:1920px;position:relative;overflow:hidden;font-family:'Arial Black',system-ui,sans-serif;box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.50) 0%,rgba(0,0,0,0.05) 35%,rgba(0,0,0,0.0) 50%,rgba(0,0,0,0.65) 100%);"></div>
  ${showBrandName ? `<div style="position:absolute;top:80px;left:72px;">${logoEl}</div>` : ""}
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding:80px 72px;">
    <div style="width:64px;height:7px;background:${primary};border-radius:4px;margin-bottom:40px;"></div>
    <h1 style="font-size:${hs}px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:1.0;margin:0;text-shadow:2px 4px 24px rgba(0,0,0,0.55);">${hookText}</h1>
  </div>
  <div style="position:absolute;bottom:100px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:16px;">
    <div style="width:44px;height:44px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:22px;">&#9654;</span>
    </div>
    <span style="color:#ffffffCC;font-size:26px;font-weight:500;text-shadow:1px 2px 8px rgba(0,0,0,0.5);">${subText}</span>
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

  let message = shortMessage || "Wishing you a wonderful birthday filled with joy and celebration!";
  try {
    if (hasAI() && !shortMessage) {
      const result = await aiJSON(`You are a warm copywriter for an African business.
Brand: ${brand.name}. We are celebrating ${personName}${personRole ? `, our ${personRole}` : ""}.

Write a heartfelt birthday message. Return JSON: { "message": "string (2 sentences, warm and celebratory, brand-appropriate)" }
Never use em dashes.`, "{}");
      if (result.message) message = result.message;
    }
  } catch { }

  const photoUrl = await resolvePhotoUrl("birthday celebration confetti balloons african joy colorful", 1080, 1080);
  const html = buildBirthdayPostHtml({ personName, personRole, message, brandName: brand.name, colors, showBrandName, logoUrl, photoUrl });
  res.json({ html, message });
});

function buildBirthdayPostHtml({ personName, personRole, message, brandName, colors, showBrandName, logoUrl, photoUrl }: {
  personName: string; personRole?: string; message: string;
  brandName: string; colors: string[]; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
}) {
  const [primary, secondary] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917"];
  const nameFz = personName.length > 14 ? 68 : personName.length > 8 ? 84 : 100;
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:44px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:17px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;">${brandName}</span>`;

  return `<div style="width:1080px;height:1080px;position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;text-align:center;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.54);"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:80px;gap:22px;">
    <div style="font-size:72px;line-height:1;">&#127881;</div>
    <p style="color:${primary};font-size:20px;font-weight:900;letter-spacing:6px;text-transform:uppercase;margin:0;">HAPPY BIRTHDAY</p>
    <h1 style="font-size:${nameFz}px;font-weight:900;color:#ffffff;line-height:1.0;margin:0;letter-spacing:-2px;">${personName}</h1>
    ${personRole ? `<p style="color:${primary};font-size:21px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;">${personRole}</p>` : ""}
    <div style="width:72px;height:3px;background:${primary};border-radius:2px;margin:4px 0;"></div>
    <p style="color:#ffffffCC;font-size:24px;line-height:1.6;margin:0;max-width:780px;">${message}</p>
  </div>
  ${showBrandName ? `<div style="position:absolute;bottom:0;left:0;right:0;background:${secondary};padding:24px 52px;display:flex;justify-content:center;">${logoEl}</div>` : ""}
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
  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const photoUrl = await resolvePhotoUrl(industryPhotoQuery(brand.industry, "professional team satisfied customer"), w, h);
  const html = buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl });
  res.json({ html });
});

function buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName, colors, format, showBrandName, logoUrl, photoUrl }: {
  testimonialText: string; customerName?: string; customerRole?: string; rating: number;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
}) {
  const [primary] = [colors[0] ?? "#D97706"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const stars = Array.from({ length: 5 }, (_, i) => `<span style="color:${i < rating ? primary : "#ffffff40"};font-size:36px;">&#9733;</span>`).join("");
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:36px;max-width:140px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:15px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;opacity:0.8;">${brandName}</span>`;
  const initials = customerName ? customerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";
  const ts = testimonialText.length > 150 ? 30 : testimonialText.length > 90 ? 36 : 42;

  return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.70);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${primary};"></div>
  <div style="position:absolute;inset:6px 0 0 0;display:flex;flex-direction:column;justify-content:center;padding:80px 90px;gap:28px;">
    <div style="display:flex;gap:4px;">${stars}</div>
    <div style="font-size:110px;color:${primary};line-height:0.55;opacity:0.45;font-family:Georgia,serif;">"</div>
    <p style="color:#ffffff;font-size:${ts}px;font-weight:600;line-height:1.55;margin:0;">${testimonialText}"</p>
    ${customerName ? `<div style="display:flex;align-items:center;gap:20px;margin-top:8px;">
      <div style="width:64px;height:64px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:#fff;font-size:24px;font-weight:700;">${initials}</span>
      </div>
      <div>
        <p style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">${customerName}</p>
        ${customerRole ? `<p style="color:#ffffff88;font-size:20px;margin:4px 0 0;">${customerRole}</p>` : ""}
      </div>
    </div>` : ""}
  </div>
  ${showBrandName ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:28px 90px;border-top:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;">${logoEl}</div>` : ""}
</div>`;
}

export default router;
