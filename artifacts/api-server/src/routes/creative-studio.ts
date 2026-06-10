import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandVisualPrefsTable, brandDnaTable, generatedDesignsTable } from "@workspace/db";
import { aiJSON, hasAI, generateImage, hasImageAI } from "../lib/ai.js";

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
  const hs = headline.length > 45 ? 52 : headline.length > 30 ? 64 : 76;
  const isFirst = slideNumber === 1;

  const brandTag = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" alt="${brandName}" style="height:40px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`
        : `<span style="font-size:16px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${primary};font-family:${FONT_STACK};">${brandName}</span>`)
    : "";

  const accentBar = `<div style="position:absolute;left:0;top:0;bottom:0;width:20px;background:linear-gradient(180deg,${primary} 0%,${primary}80 100%);"></div>`;
  const bgDecor = isFirst
    ? `<div style="position:absolute;top:-160px;right:-160px;width:540px;height:540px;border-radius:50%;background:${primary};opacity:0.09;"></div>`
    : `<div style="position:absolute;bottom:-120px;right:-120px;width:400px;height:400px;border-radius:50%;background:${primary};opacity:0.07;"></div>`;

  const progressDots = Array.from({ length: total }, (_, i) =>
    `<div style="width:${i === slideNumber - 1 ? "30px" : "9px"};height:9px;border-radius:5px;background:${i === slideNumber - 1 ? primary : text + "28"};"></div>`
  ).join("");

  return `${FONT_IMPORT}<div style="width:1080px;height:1080px;background:${bg};display:flex;flex-direction:column;font-family:${FONT_STACK};box-sizing:border-box;position:relative;overflow:hidden;">
  ${accentBar}${bgDecor}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:56px 60px 0 86px;position:relative;">
    ${brandTag || "<span></span>"}
    <div style="padding:9px 22px;background:${primary}20;border:1.5px solid ${primary}50;border-radius:100px;">
      <span style="color:${primary};font-size:16px;font-weight:700;font-family:${FONT_STACK};">${slideNumber}/${total}</span>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:36px 60px 36px 86px;position:relative;gap:28px;">
    ${isFirst ? `<div style="display:inline-flex;align-items:center;padding:8px 22px;background:${primary};border-radius:100px;width:fit-content;"><span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:${FONT_STACK};">START HERE</span></div>` : ""}
    <h2 style="color:${text};font-size:${hs}px;font-weight:900;line-height:1.1;margin:0;letter-spacing:-1px;font-family:${FONT_STACK};">${headline}</h2>
    <p style="color:${text}BB;font-size:27px;line-height:1.65;margin:0;max-width:860px;font-family:${FONT_STACK};">${body}</p>
    ${cta ? `<div style="padding:18px 42px;background:${primary};display:inline-block;border-radius:100px;"><span style="color:#fff;font-size:22px;font-weight:700;font-family:${FONT_STACK};">${cta} &#8594;</span></div>` : ""}
  </div>
  <div style="padding:0 60px 50px 86px;display:flex;align-items:center;gap:8px;position:relative;">
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
  const gradientBg = backgroundStyle === "gradient"
    ? `background:linear-gradient(145deg,${bg} 0%,${bg} 55%,${primary}40 100%)`
    : backgroundStyle === "brand"
    ? `background:${primary}`
    : `background:${bg}`;
  const textOnBrand = backgroundStyle === "brand" ? "#fff" : text;
  const accentOnBrand = backgroundStyle === "brand" ? "#fff" : primary;

  const brandBlock = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" alt="${brandName}" style="height:38px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`
        : `<span style="font-size:16px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${backgroundStyle === "brand" ? "#fff" : primary};font-family:${FONT_STACK};">${brandName}</span>`)
    : "";

  const qs = quoteText.length > 140 ? 36 : quoteText.length > 80 ? 44 : 52;
  return `${FONT_IMPORT}<div style="${dims};${gradientBg};display:flex;flex-direction:column;font-family:${FONT_STACK};box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="position:absolute;top:-180px;right:-180px;width:600px;height:600px;border-radius:50%;background:${accentOnBrand};opacity:0.10;"></div>
  <div style="position:absolute;bottom:-100px;left:-100px;width:380px;height:380px;border-radius:50%;background:${accentOnBrand};opacity:0.08;"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:${accentOnBrand};opacity:0.9;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 60px 110px;position:relative;gap:28px;">
    <div style="font-size:140px;color:${accentOnBrand};line-height:0.5;font-family:Georgia,serif;opacity:0.30;">&ldquo;</div>
    <p style="color:${textOnBrand};font-size:${qs}px;font-weight:700;line-height:1.45;margin:0;letter-spacing:-0.3px;">${quoteText}&rdquo;</p>
    ${attribution ? `<div style="display:flex;align-items:center;gap:16px;margin-top:4px;">
      <div style="width:36px;height:3px;background:${accentOnBrand};border-radius:2px;opacity:0.7;"></div>
      <p style="color:${textOnBrand}AA;font-size:22px;font-weight:600;margin:0;font-family:${FONT_STACK};">${attribution}</p>
    </div>` : ""}
  </div>
  ${brandBlock ? `<div style="padding:28px 80px 52px 110px;position:relative;display:flex;align-items:center;">${brandBlock}</div>` : ""}
</div>`;
}

// ─── Shared design constants ──────────────────────────────────────────────────
const FONT_STACK = `'Poppins','Trebuchet MS','Segoe UI',system-ui,sans-serif`;
const FONT_IMPORT = `<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');</style>`;

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

/** Consolidated brand context passed into DNA-aware prompt building */
interface BrandImageContext {
  brandName: string;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  targetMarket?: string | null;
  brandBrief?: string | null;
  colors: string[];          // hex codes from visual prefs
  designStyle?: string;
  // from brand_dna (all optional — not all brands have DNA built)
  toneOfVoice?: string;
  targetAudience?: string;   // JSON string
  brandPersonality?: string; // e.g. "Formality: 6/10, Energy: 8/10, Boldness: 7/10"
  culturalContext?: string;  // JSON string
  coreValues?: string[];
  uniqueSellingPoints?: string[];
  keyMessages?: string[];
}

/** Convert a hex color to a human-readable color name for prompt use */
function hexToColorName(hex: string): string {
  const map: Record<string, string> = {
    "#000000": "black", "#ffffff": "white", "#ff0000": "red", "#00ff00": "green",
    "#0000ff": "blue", "#ffff00": "yellow", "#ff6600": "orange", "#ff9900": "amber",
    "#d97706": "amber gold", "#b45309": "dark amber", "#92400e": "warm brown",
    "#1c1917": "deep charcoal", "#111827": "near black", "#1f2937": "dark slate",
    "#374151": "slate grey", "#6b7280": "cool grey", "#9ca3af": "light grey",
    "#f3f4f6": "off white", "#faf8f0": "cream", "#fef3c7": "pale yellow",
    "#fde68a": "light gold", "#fbbf24": "golden yellow", "#f59e0b": "warm amber",
    "#ef4444": "bright red", "#dc2626": "deep red", "#b91c1c": "dark red",
    "#10b981": "emerald green", "#059669": "deep green", "#047857": "forest green",
    "#3b82f6": "bright blue", "#2563eb": "royal blue", "#1d4ed8": "deep blue",
    "#8b5cf6": "purple", "#7c3aed": "deep purple", "#6d28d9": "violet",
    "#ec4899": "pink", "#db2777": "hot pink", "#be185d": "deep pink",
    "#14b8a6": "teal", "#0d9488": "deep teal", "#0f766e": "dark teal",
  };
  const normalized = hex.toLowerCase();
  if (map[normalized]) return map[normalized];
  // Heuristic for unknown hex
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (r > 200 && g > 150 && b < 80) return "warm gold";
  if (r > 180 && g < 80 && b < 80) return "rich red";
  if (r < 80 && g > 150 && b < 80) return "vibrant green";
  if (r < 80 && g < 80 && b > 180) return "deep blue";
  if (r > 180 && g > 180 && b > 180) return "light silver";
  if (r < 60 && g < 60 && b < 60) return "near black";
  return hex; // fallback to raw hex
}

/**
 * Build a rich FLUX image generation prompt from the full brand DNA context.
 * The result is a photorealistic, brand-aware scene description.
 */
function buildDNAFluxPrompt(opts: {
  scene: string;
  ctx: BrandImageContext;
  mood?: string;
  aspectHint?: string;
  postType?: string;
}): string {
  const { scene, ctx, mood, aspectHint = "square format", postType } = opts;

  // ── Location / cultural setting ──
  const locationParts: string[] = [];
  if (ctx.city) locationParts.push(ctx.city);
  if (ctx.country) locationParts.push(ctx.country);
  const locationStr = locationParts.length
    ? `in ${locationParts.join(", ")}`
    : "in an African urban setting";

  // ── Industry environment ──
  const industryEnv: Record<string, string> = {
    "Food & Beverage": "warm restaurant ambiance, beautiful food plating, rich textures, dining atmosphere",
    "Health & Wellness": "bright wellness studio, natural light, clean energetic lifestyle environment",
    "Healthcare & Medical": "modern clinic or hospital setting, professional medical environment, clean and bright",
    "Beauty & Personal Care": "elegant beauty salon or studio, soft flattering lighting, luxury cosmetic products",
    "Fashion & Apparel": "high-fashion editorial setting, stylish clothing display, aspirational style",
    "Technology & SaaS": "modern tech office, sleek digital devices, professional contemporary workspace",
    "Real Estate & Property": "luxury interior or architectural photography, aspirational living space",
    "Education & Training": "bright classroom or learning environment, engaged students, academic setting",
    "Entertainment & Events": "vibrant event venue, dynamic atmosphere, colorful celebration",
    "Travel & Hospitality": "luxury hotel or tropical destination, premium travel experience",
    "Agriculture & Farming": "lush farmland, golden hour light, sustainable and productive farm",
    "Retail & E-commerce": "beautiful commercial product display, clean retail photography",
    "Fintech & Payments": "modern finance office, digital payment interface, professional business setting",
    "Logistics & Courier": "professional delivery and logistics, urban operations, efficient and modern",
    "Construction & Engineering": "modern architecture or construction site, engineering excellence",
    "Non-profit & NGO": "community empowerment scene, hopeful African community, volunteers and impact",
    "Church & Religious Organisation": "uplifting community gathering, spiritual atmosphere, light and hope",
    "Domestic Staffing & Caregiving": "warm home environment, professional caregiving, domestic setting",
  };
  const envCtx = industryEnv[ctx.industry ?? ""] ?? "professional African business environment";

  // ── Brand color lighting ──
  const colorNames = ctx.colors.slice(0, 2).map(hexToColorName).filter(Boolean);
  const colorStr = colorNames.length
    ? `with ${colorNames.join(" and ")} color tones and accents`
    : "";

  // ── Brand personality / energy ──
  let personalityStr = "";
  if (ctx.brandPersonality) {
    const energyMatch = ctx.brandPersonality.match(/Energy:\s*(\d+)/i);
    const boldnessMatch = ctx.brandPersonality.match(/Boldness:\s*(\d+)/i);
    const formalityMatch = ctx.brandPersonality.match(/Formality:\s*(\d+)/i);
    const energy = energyMatch ? parseInt(energyMatch[1]) : 5;
    const boldness = boldnessMatch ? parseInt(boldnessMatch[1]) : 5;
    const formality = formalityMatch ? parseInt(formalityMatch[1]) : 5;
    if (energy >= 7) personalityStr = "dynamic, high-energy";
    else if (energy <= 3) personalityStr = "calm, serene";
    if (boldness >= 7) personalityStr += personalityStr ? ", bold and striking" : "bold and striking";
    if (formality >= 7) personalityStr += personalityStr ? ", formal and refined" : "formal and refined";
    else if (formality <= 3) personalityStr += personalityStr ? ", casual and approachable" : "casual and approachable";
  }

  // ── Target audience visual representation ──
  let audienceStr = "";
  if (ctx.targetAudience) {
    try {
      const ta = JSON.parse(ctx.targetAudience);
      if (ta.age_range) audienceStr = `targeting ${ta.age_range} demographic`;
      if (ta.gender && ta.gender !== "all") audienceStr += ` ${ta.gender}`;
    } catch { /* not valid JSON, try plain text */ }
    if (!audienceStr && ctx.targetAudience.length < 80) {
      audienceStr = `for ${ctx.targetAudience}`;
    }
  }

  // ── Design style → photography style ──
  const styleMap: Record<string, string> = {
    "bold": "bold dramatic lighting, high contrast, vibrant",
    "minimal": "clean minimalist composition, soft natural light, airy",
    "professional": "polished professional photography, clean composition",
    "warm": "warm golden tones, soft inviting light, cozy",
    "luxury": "luxury editorial style, rich textures, premium feel",
    "playful": "bright cheerful colors, fun dynamic composition",
    "modern": "sleek modern aesthetics, contemporary clean style",
  };
  const styleStr = styleMap[ctx.designStyle ?? "professional"] ?? "polished professional photography";

  // ── Tone of voice → visual mood ──
  let toneStr = mood ?? "";
  if (!toneStr && ctx.toneOfVoice) {
    const tone = ctx.toneOfVoice.toLowerCase();
    if (tone.includes("premium") || tone.includes("luxury")) toneStr = "premium luxury";
    else if (tone.includes("playful") || tone.includes("fun")) toneStr = "cheerful vibrant";
    else if (tone.includes("empow") || tone.includes("inspir")) toneStr = "empowering inspiring";
    else if (tone.includes("trust") || tone.includes("reliable")) toneStr = "trustworthy warm";
    else if (tone.includes("bold") || tone.includes("energetic")) toneStr = "bold energetic";
    else toneStr = "professional confident";
  }

  // ── Core values / USP context ──
  const valuesStr = ctx.coreValues?.slice(0, 2).join(", ") ?? "";

  // ── Assemble the final prompt ──
  const parts = [
    `${toneStr ? toneStr + " mood, " : ""}${scene}`,
    locationStr,
    envCtx,
    colorStr,
    styleStr,
    personalityStr,
    audienceStr,
    valuesStr ? `evoking ${valuesStr}` : "",
    aspectHint,
    "photorealistic, ultra high quality, professional marketing photography, 4k resolution, sharp focus, beautiful composition, cinematic lighting, magazine quality",
    "No text overlays, no logos, no watermarks, no graphic design elements",
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Get a photo URL — tries Together AI FLUX first, falls back to Unsplash.
 */
async function resolvePhotoUrl(query: string, w: number, h: number, fluxPrompt?: string): Promise<string> {
  // Try FLUX.1 AI image generation first
  if (hasImageAI() && fluxPrompt) {
    try {
      // FLUX.1-schnell supports specific dimensions; snap to nearest supported size
      const fluxW = w <= 768 ? 768 : w <= 1024 ? 1024 : 1440;
      const fluxH = h <= 768 ? 768 : h <= 1024 ? 1024 : h <= 1440 ? 1440 : 1024;
      const dataUrl = await generateImage({ prompt: fluxPrompt, width: fluxW, height: fluxH, steps: 4 });
      console.log(`[ImageAI] FLUX generated ${fluxW}x${fluxH} image`);
      return dataUrl;
    } catch (err: any) {
      console.warn(`[ImageAI] FLUX failed, falling back to Unsplash: ${err.message}`);
    }
  }

  // Fallback: Unsplash
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

// ─── Brand bar + contact helpers ──────────────────────────────────────────────
interface ContactInfo { website?: string; instagram?: string; phone?: string; }

function contactSnippet(ci: ContactInfo, color = "#ffffffCC", fz = 18): string {
  const items: string[] = [];
  if (ci.website) items.push(`<span>🌐 ${ci.website}</span>`);
  if (ci.instagram) items.push(`<span>📷 ${ci.instagram}</span>`);
  if (ci.phone) items.push(`<span>📞 ${ci.phone}</span>`);
  return items.length ? `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;color:${color};font-size:${fz}px;font-weight:600;">${items.join("")}</div>` : "";
}

function logoJustify(pos: string): string {
  return pos.endsWith("right") ? "flex-end" : pos.endsWith("center") ? "center" : "flex-start";
}

// Returns HTML for floating logo (if top position) + bottom brand bar
function brandBar({ showBrandName, logoEl, logoPosition = "bottom-center", bg, ci = {}, padH = 52, padV = 24 }: {
  showBrandName: boolean; logoEl: string; logoPosition?: string; bg: string; ci?: ContactInfo; padH?: number; padV?: number;
}): string {
  const ctHtml = contactSnippet(ci);
  const hasContact = !!ctHtml;
  const isTop = logoPosition.startsWith("top");
  let out = "";
  if (showBrandName && isTop) {
    const hPos = logoPosition.endsWith("right") ? `right:${padH}px` : `left:${padH}px`;
    out += `<div style="position:absolute;top:${padV + 28}px;${hPos};z-index:10;">${logoEl}</div>`;
  }
  const bottomLogo = !isTop && showBrandName;
  if (bottomLogo || hasContact) {
    const justify = bottomLogo && hasContact ? "space-between" : bottomLogo ? logoJustify(logoPosition) : "center";
    out += `<div style="position:absolute;bottom:0;left:0;right:0;background:${bg};padding:${padV}px ${padH}px;display:flex;align-items:center;justify-content:${justify};gap:20px;">${bottomLogo ? logoEl : ""}${ctHtml}</div>`;
  }
  return out;
}

// ─── Announcement ─────────────────────────────────────────────────────────────
router.post("/generate/announcement", async (req, res): Promise<void> => {
  const { brandId, eventDetails, ctaText, format = "square", showBrandName = true, logoPosition = "bottom-center", contactInfo = {}, customPhotoDataUrl, smoothFace = false } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }
  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };

  let headline = "BIG NEWS IS HERE", subtext = eventDetails || "Stay tuned for something exciting.", cta = ctaText || "Learn More";
  let imageScene = `${brand.name} ${brand.industry ?? "business"} announcement launch event, ${brand.city ?? brand.country ?? "African city"} setting, outdoor or modern venue`;
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a brand copywriter for African businesses.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. Location: ${brand.city ?? brand.country ?? "Nigeria"}.
Event/Announcement details: ${eventDetails || "General announcement — make something exciting"}

Generate announcement copy. Return JSON:
{
  "headline": "string (max 8 words, punchy, ALL CAPS friendly)",
  "subtext": "string (max 18 words, supporting detail)",
  "cta": "string (max 4 words)",
  "imageScene": "string (10-15 words describing a specific photorealistic scene for this brand's announcement — no text, include location context)"
}
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.subtext) subtext = result.subtext;
      if (result.cta) cta = ctaText || result.cta;
      if (result.imageScene) imageScene = result.imageScene;
    }
  } catch { }

  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const aspectHint = format === "story" ? "portrait 9:16 vertical format" : format === "portrait" ? "portrait 4:5 format" : "square format";
  const fluxPrompt = buildDNAFluxPrompt({ scene: imageScene, ctx: brandCtx, aspectHint, postType: "announcement" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, "announcement launch event outdoor"), w, h, fluxPrompt);
  const html = buildAnnouncementHtml({ headline, subtext, cta, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, smoothFace, designStyle: prefs?.designStyle ?? "professional" });
  res.json({ html, headline, subtext, cta });
});

function buildAnnouncementHtml({ headline, subtext, cta, brandName, colors, format, showBrandName, logoUrl, photoUrl, logoPosition = "bottom-center", contactInfo = {}, smoothFace = false, designStyle = "professional" }: {
  headline: string; subtext: string; cta: string; brandName: string; colors: string[];
  format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean; designStyle?: string;
}) {
  const primary   = colors[0] ?? "#D97706";
  const secondary = colors[1] ?? "#1C1917";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const dims = `width:1080px;height:${h}px`;
  const isStory = format === "story";
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const hl = headline.length;
  const hs = hl > 50 ? (isStory ? 72 : 60) : hl > 35 ? (isStory ? 90 : 74) : hl > 20 ? (isStory ? 110 : 90) : (isStory ? 130 : 108);
  const padH = isStory ? 80 : 64;
  const sText = isStory ? 36 : 28;
  const ctHtml = contactSnippet(contactInfo, "rgba(255,255,255,0.75)", isStory ? 24 : 18);

  const logoElt = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:${isStory ? 54 : 42}px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />`
        : `<div style="display:flex;align-items:center;gap:10px;">
             <div style="width:${isStory ? 50 : 40}px;height:${isStory ? 50 : 40}px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <span style="color:#fff;font-size:${isStory ? 22 : 18}px;font-weight:900;font-family:${FONT_STACK};">${brandName.charAt(0).toUpperCase()}</span>
             </div>
             <span style="color:#fff;font-size:${isStory ? 20 : 17}px;font-weight:700;font-family:${FONT_STACK};">${brandName}</span>
           </div>`)
    : "";

  // ── MINIMAL: light editorial — cream bg, brand-color headline, photo card ────
  if (designStyle === "minimal") {
    const bg = "#FAF8F0";
    const darkText = "#1a1a1a";
    const cardW = isStory || format === "portrait" ? (1080 - padH * 2) : 390;
    const cardH = isStory ? Math.round(h * 0.40) : format === "portrait" ? 520 : 468;
    const headlineFz = hl > 50 ? (isStory ? 68 : 44) : hl > 35 ? (isStory ? 84 : 56) : hl > 20 ? (isStory ? 104 : 72) : (isStory ? 124 : 92);
    const ctHtmlLight = contactSnippet(contactInfo, secondary, isStory ? 22 : 17);
    const logoTopEl = showBrandName
      ? (logoUrl
          ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:${isStory ? 50 : 38}px;max-width:180px;object-fit:contain;" />`
          : `<div style="display:flex;align-items:center;gap:10px;">
               <div style="width:${isStory ? 44 : 34}px;height:${isStory ? 44 : 34}px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                 <span style="color:#fff;font-size:${isStory ? 20 : 15}px;font-weight:900;font-family:${FONT_STACK};">${brandName.charAt(0).toUpperCase()}</span>
               </div>
               <span style="color:${secondary};font-size:${isStory ? 18 : 15}px;font-weight:700;font-family:${FONT_STACK};">${brandName}</span>
             </div>`)
      : "";

    if (isStory || format === "portrait") {
      return `${FONT_IMPORT}<div style="${dims};background:${bg};font-family:${FONT_STACK};position:relative;overflow:hidden;box-sizing:border-box;padding:${padH}px;">
  <div style="position:absolute;top:-100px;right:-80px;width:440px;height:440px;border-radius:50%;background:${primary};opacity:0.05;pointer-events:none;"></div>
  <div style="position:absolute;bottom:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:${secondary};opacity:0.04;pointer-events:none;"></div>
  ${logoTopEl ? `<div style="margin-bottom:${isStory ? 48 : 36}px;">${logoTopEl}</div>` : ""}
  <h1 style="font-size:${headlineFz}px;font-weight:900;color:${primary};line-height:1.05;margin:0 0 ${isStory ? 26 : 20}px;letter-spacing:-0.5px;">${headline}</h1>
  <p style="font-size:${isStory ? 32 : 26}px;color:${darkText};line-height:1.6;margin:0 0 ${isStory ? 44 : 32}px;">${subtext}</p>
  <div style="border-radius:28px;overflow:hidden;transform:rotate(1.5deg);box-shadow:0 20px 60px rgba(0,0,0,0.10);margin-bottom:${isStory ? 48 : 36}px;width:${cardW}px;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:${cardH}px;object-fit:cover;${smoothStyle}" />
  </div>
  ${cta ? `<div style="display:inline-flex;background:${secondary};color:#fff;padding:${isStory ? "18px 44px" : "14px 36px"};border-radius:100px;font-weight:700;font-size:${isStory ? 28 : 22}px;">${cta}</div>` : ""}
  ${ctHtmlLight ? `<div style="margin-top:${isStory ? 28 : 20}px;">${ctHtmlLight}</div>` : ""}
</div>`;
    }

    // HORIZONTAL layout (square): text left, photo card right
    const gap = 52;
    const logoH = showBrandName ? 74 : 0;
    const textW = 1080 - padH * 2 - cardW - gap;
    return `${FONT_IMPORT}<div style="${dims};background:${bg};font-family:${FONT_STACK};position:relative;overflow:hidden;box-sizing:border-box;padding:${padH}px;">
  <div style="position:absolute;top:-120px;right:-80px;width:460px;height:460px;border-radius:50%;background:${primary};opacity:0.05;pointer-events:none;"></div>
  <div style="position:absolute;bottom:-80px;left:-60px;width:320px;height:320px;border-radius:50%;background:${secondary};opacity:0.04;pointer-events:none;"></div>
  ${logoTopEl ? `<div style="margin-bottom:24px;">${logoTopEl}</div>` : ""}
  <div style="display:flex;align-items:center;gap:${gap}px;height:${h - padH * 2 - logoH}px;">
    <div style="width:${textW}px;display:flex;flex-direction:column;justify-content:center;gap:20px;">
      <h1 style="font-size:${headlineFz}px;font-weight:900;color:${primary};line-height:1.05;margin:0;letter-spacing:-0.5px;">${headline}</h1>
      <p style="font-size:${sText}px;color:${darkText};line-height:1.65;margin:0;">${subtext}</p>
      ${cta ? `<div style="display:inline-flex;align-self:flex-start;background:${secondary};color:#fff;padding:14px 36px;border-radius:100px;font-weight:700;font-size:22px;">${cta}</div>` : ""}
      ${ctHtmlLight ? ctHtmlLight : ""}
    </div>
    <div style="width:${cardW}px;flex-shrink:0;">
      <div style="border-radius:24px;overflow:hidden;transform:rotate(2deg);box-shadow:0 24px 64px rgba(0,0,0,0.10);">
        <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:${cardH}px;object-fit:cover;${smoothStyle}" />
      </div>
    </div>
  </div>
</div>`;
  }

  // ── BOLD: brand color sweep from left ───────────────────────────────────────
  // ── PROFESSIONAL (default): brand-colored gradient from bottom ──────────────
  const overlay = designStyle === "bold"
    ? `linear-gradient(110deg,${secondary}F8 0%,${secondary}C0 38%,${primary}60 68%,transparent 100%)`
    : `linear-gradient(to top,${secondary}F5 0%,${secondary}CC 22%,${secondary}80 48%,rgba(0,0,0,0.08) 72%,transparent 100%)`;

  const topLogo = logoElt
    ? `<div style="position:absolute;top:${isStory ? 72 : 48}px;left:${padH}px;z-index:10;background:rgba(0,0,0,0.25);padding:${isStory ? "14px 22px" : "10px 18px"};border-radius:100px;">${logoElt}</div>`
    : "";

  const ctaHtml = cta
    ? `<div style="display:inline-flex;align-self:flex-start;background:${primary};color:#fff;padding:${isStory ? "18px 46px" : "13px 36px"};border-radius:100px;font-weight:700;font-size:${isStory ? 28 : 21}px;margin-top:${isStory ? 38 : 24}px;">${cta}</div>`
    : "";

  return `${FONT_IMPORT}<div style="${dims};position:relative;overflow:hidden;font-family:${FONT_STACK};box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  <div style="position:absolute;inset:0;background:${overlay};"></div>
  ${topLogo}
  <div style="position:absolute;bottom:${isStory ? 140 : 86}px;left:${padH}px;right:${padH}px;">
    <div style="width:52px;height:5px;background:${primary};margin-bottom:${isStory ? 26 : 18}px;border-radius:3px;"></div>
    <h1 style="font-size:${hs}px;font-weight:900;color:#fff;line-height:1.05;margin:0;letter-spacing:-0.5px;">${headline}</h1>
    <p style="font-size:${sText}px;font-weight:400;color:rgba(255,255,255,0.83);margin:${isStory ? 24 : 16}px 0 0;line-height:1.58;max-width:880px;">${subtext}</p>
    ${ctaHtml}
    ${ctHtml ? `<div style="margin-top:${isStory ? 28 : 18}px;">${ctHtml}</div>` : ""}
  </div>
</div>`;
}

// ─── Product Showcase ─────────────────────────────────────────────────────────
router.post("/generate/product-showcase", async (req, res): Promise<void> => {
  const { brandId, productName, productDescription, price, ctaText, format = "square", showBrandName = true, logoPosition = "bottom-center", contactInfo = {}, customPhotoDataUrl, smoothFace = false } = req.body;
  if (!brandId || !productName) { res.status(400).json({ error: "brandId and productName required" }); return; }
  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };

  let headline = `Introducing ${productName}`, tagline = productDescription || "Premium quality, made for you.";
  let cta = ctaText || "Shop Now";
  let imageScene = `${productName} product lifestyle shot, ${brand.city ?? brand.country ?? "African city"}, ${brand.industry ?? "retail"} context`;
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a product marketer for African brands.
Brand: ${brand.name} (${brand.industry ?? "business"}, ${brand.city ?? brand.country ?? "Nigeria"}).
Product: ${productName}. ${productDescription ? `Description: ${productDescription}` : ""}
${price ? `Price: ${price}` : ""}

Write product showcase copy. Return JSON:
{
  "headline": "string (punchy hook, max 8 words)",
  "tagline": "string (value prop, max 12 words)",
  "cta": "string (max 3 words)",
  "imageScene": "string (10-15 words: a specific photorealistic scene showing this product in context — place, lighting, setting, no text)"
}
Never use em dashes.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.tagline) tagline = result.tagline;
      if (result.cta) cta = ctaText || result.cta;
      if (result.imageScene) imageScene = result.imageScene;
    }
  } catch { }

  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const aspectHint = format === "story" ? "portrait 9:16 vertical format" : format === "portrait" ? "portrait 4:5 format" : "square format";
  const fluxPrompt = buildDNAFluxPrompt({ scene: imageScene, ctx: brandCtx, aspectHint, postType: "product-showcase" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, `${productName} product lifestyle`), w, h, fluxPrompt);
  const html = buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, smoothFace });
  res.json({ html, headline, tagline, cta });
});

function buildProductShowcaseHtml({ productName, headline, tagline, price, cta, brandName, colors, format, showBrandName, logoUrl, photoUrl, logoPosition = "bottom-center", contactInfo = {}, smoothFace = false }: {
  productName: string; headline: string; tagline: string; price?: string; cta: string;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean;
}) {
  const primary   = colors[0] ?? "#D97706";
  const secondary = colors[1] ?? "#1C1917";
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const dims = `width:1080px;height:${h}px`;
  const cardH = Math.round(h * 0.40);
  const hs = headline.length > 35 ? 52 : headline.length > 22 ? 64 : 76;
  const isTop = logoPosition.startsWith("top");
  const cardAlign = logoJustify(logoPosition);

  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:38px;max-width:160px;object-fit:contain;" />`
    : `<span style="font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${primary};font-family:${FONT_STACK};">${brandName}</span>`;

  const logoElInv = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:40px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff;font-family:${FONT_STACK};">${brandName}</span>`;

  const floatLogoHtml = showBrandName && isTop
    ? `<div style="position:absolute;top:52px;${logoPosition.endsWith("right") ? "right" : "left"}:52px;z-index:10;background:rgba(0,0,0,0.28);padding:10px 20px;border-radius:100px;">${logoElInv}</div>`
    : "";

  const cardLogoEl = showBrandName && !isTop
    ? `<div style="display:flex;justify-content:${cardAlign};margin-bottom:14px;">${logoEl}</div>`
    : "";
  const ctHtml = contactSnippet(contactInfo, "#666", 16);

  return `${FONT_IMPORT}<div style="${dims};position:relative;overflow:hidden;font-family:${FONT_STACK};box-sizing:border-box;background:#f3f3f3;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:${h - cardH + 90}px;object-fit:cover;object-position:center top;${smoothStyle}" />
  <div style="position:absolute;top:0;left:0;right:0;height:${h - cardH + 90}px;background:linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(0,0,0,0.10) 60%,rgba(243,243,243,1) 100%);"></div>
  ${floatLogoHtml}
  <div style="position:absolute;bottom:0;left:0;right:0;height:${cardH}px;background:#ffffff;border-radius:28px 28px 0 0;padding:${Math.round(cardH * 0.09)}px 52px ${Math.round(cardH * 0.11)}px;border-top:7px solid ${primary};">
    ${cardLogoEl}
    <h1 style="font-size:${hs}px;font-weight:900;color:${secondary};margin:0 0 10px;line-height:1.1;letter-spacing:-0.5px;font-family:${FONT_STACK};">${headline}</h1>
    <p style="font-size:23px;color:#555;margin:0 0 20px;line-height:1.5;font-family:${FONT_STACK};">${tagline}</p>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      ${price ? `<div style="padding:10px 26px;background:${primary}18;border:2px solid ${primary};border-radius:100px;"><span style="font-size:24px;font-weight:900;color:${primary};font-family:${FONT_STACK};">${price}</span></div>` : ""}
      <div style="padding:16px 36px;background:${primary};border-radius:100px;flex:1;text-align:center;min-width:160px;"><span style="font-size:21px;font-weight:700;color:#fff;font-family:${FONT_STACK};">${cta} &#8594;</span></div>
    </div>
    ${ctHtml ? `<div style="margin-top:18px;">${ctHtml}</div>` : ""}
  </div>
</div>`;
}

// ─── Story Cover ──────────────────────────────────────────────────────────────
router.post("/generate/story-cover", async (req, res): Promise<void> => {
  const { brandId, topic, mood = "bold", showBrandName = true, logoPosition = "top-left", contactInfo = {}, customPhotoDataUrl, smoothFace = false } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }
  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };

  let hookText = "SWIPE FOR MORE", subText = "Tap to open";
  let imageScene = `${brand.industry ?? "business"} lifestyle portrait, ${brand.city ?? brand.country ?? "African city"}, vertical framing`;
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a social media strategist for African brands.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. Location: ${brand.city ?? brand.country ?? "Nigeria"}.
Mood: ${mood}. ${topic ? `Topic: ${topic}` : "Generate a compelling hook"}

Write an Instagram/TikTok story cover. Return JSON:
{
  "hookText": "string (bold hook, max 6 words, ALL CAPS format works great)",
  "subText": "string (call to action, max 5 words)",
  "imageScene": "string (10-15 words: a specific vertical lifestyle scene for this brand — person, setting, mood, location, no text)"
}
Never use em dashes.`, "{}");
      if (result.hookText) hookText = result.hookText;
      if (result.subText) subText = result.subText;
      if (result.imageScene) imageScene = result.imageScene;
    }
  } catch { }

  const fluxPrompt = buildDNAFluxPrompt({ scene: imageScene, ctx: brandCtx, mood, aspectHint: "portrait 9:16 vertical story format", postType: "story-cover" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, "lifestyle portrait vertical"), 1080, 1920, fluxPrompt);
  const html = buildStoryCoverHtml({ hookText, subText, brandName: brand.name, colors, mood, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, smoothFace });
  res.json({ html, hookText, subText });
});

function buildStoryCoverHtml({ hookText, subText, brandName, colors, mood, showBrandName, logoUrl, photoUrl, logoPosition = "top-left", contactInfo = {}, smoothFace = false }: {
  hookText: string; subText: string; brandName: string; colors: string[];
  mood: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean;
}) {
  const primary   = colors[0] ?? "#D97706";
  const secondary = colors[1] ?? "#1C1917";
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const hs = hookText.length > 22 ? 100 : hookText.length > 12 ? 120 : 144;

  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:46px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:17px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff;font-family:${FONT_STACK};">${brandName}</span>`;

  const topLogoHtml = showBrandName && logoPosition.startsWith("top")
    ? `<div style="position:absolute;top:72px;${logoPosition.endsWith("right") ? "right" : "left"}:72px;z-index:10;background:rgba(0,0,0,0.25);padding:14px 22px;border-radius:100px;">${logoEl}</div>`
    : "";

  const bottomBarHtml = (!logoPosition.startsWith("top") && showBrandName) || !!(contactInfo.website || contactInfo.instagram || contactInfo.phone)
    ? `<div style="position:absolute;bottom:0;left:0;right:0;background:${secondary};padding:28px 72px;display:flex;align-items:center;justify-content:${showBrandName && !logoPosition.startsWith("top") ? logoJustify(logoPosition) : "center"};gap:20px;">${showBrandName && !logoPosition.startsWith("top") ? logoEl : ""}${contactSnippet(contactInfo, "#ffffffCC", 22)}</div>`
    : "";

  const hasBottomBar = !!bottomBarHtml;
  const ctaBottom = hasBottomBar ? 180 : 100;

  return `${FONT_IMPORT}<div style="width:1080px;height:1920px;position:relative;overflow:hidden;font-family:${FONT_STACK};box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  <div style="position:absolute;inset:0;background:linear-gradient(to top,${secondary}E8 0%,${secondary}99 28%,rgba(0,0,0,0.10) 55%,transparent 100%);"></div>
  ${topLogoHtml}
  ${bottomBarHtml}
  <div style="position:absolute;bottom:${ctaBottom + 120}px;left:0;right:0;padding:0 72px;">
    <div style="width:64px;height:6px;background:${primary};border-radius:4px;margin-bottom:36px;"></div>
    <h1 style="font-size:${hs}px;font-weight:900;color:#fff;line-height:1.0;margin:0;letter-spacing:-1px;">${hookText}</h1>
  </div>
  <div style="position:absolute;bottom:${ctaBottom}px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:16px;">
    <div style="width:48px;height:48px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:22px;">&#9654;</span>
    </div>
    <span style="color:rgba(255,255,255,0.88);font-size:28px;font-weight:500;font-family:${FONT_STACK};">${subText}</span>
  </div>
</div>`;
}

// ─── Birthday Post ────────────────────────────────────────────────────────────
router.post("/generate/birthday-post", async (req, res): Promise<void> => {
  const { brandId, personName, personRole, shortMessage, showBrandName = true, logoPosition = "bottom-center", contactInfo = {}, celebrantPhotoDataUrl, customPhotoDataUrl, smoothFace = false } = req.body;
  if (!brandId || !personName) { res.status(400).json({ error: "brandId and personName required" }); return; }
  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };

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

  const birthdayScene = `joyful birthday celebration, confetti, balloons, festive decor, bokeh lights, ${brand.city ?? brand.country ?? "African city"} party setting, warm celebratory atmosphere`;
  const birthdayFluxPrompt = buildDNAFluxPrompt({ scene: birthdayScene, ctx: brandCtx, mood: "joyful celebratory", aspectHint: "square format", postType: "birthday-post" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl("birthday celebration confetti balloons african joy colorful", 1080, 1080, birthdayFluxPrompt);
  const html = buildBirthdayPostHtml({ personName, personRole, message, brandName: brand.name, colors, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, celebrantPhotoDataUrl, smoothFace });
  res.json({ html, message });
});

function buildBirthdayPostHtml({ personName, personRole, message, brandName, colors, showBrandName, logoUrl, photoUrl, logoPosition = "bottom-center", contactInfo = {}, celebrantPhotoDataUrl, smoothFace = false }: {
  personName: string; personRole?: string; message: string;
  brandName: string; colors: string[]; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; celebrantPhotoDataUrl?: string; smoothFace?: boolean;
}) {
  const [primary, secondary] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917"];
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.08) contrast(1.04) brightness(1.02);" : "";
  const nameFz = personName.length > 14 ? 68 : personName.length > 8 ? 84 : 100;
  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:44px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:17px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;">${brandName}</span>`;

  const barHtml = brandBar({ showBrandName, logoEl, logoPosition, bg: secondary, ci: contactInfo, padH: 52, padV: 24 });

  if (celebrantPhotoDataUrl) {
    const circleSize = 360;
    return `<div style="width:1080px;height:1080px;position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;background:linear-gradient(145deg,${secondary} 0%,${secondary}EE 45%,${primary}22 100%);">
  <div style="position:absolute;top:-120px;right:-120px;width:520px;height:520px;border-radius:50%;background:${primary};opacity:0.08;"></div>
  <div style="position:absolute;bottom:50px;left:-90px;width:320px;height:320px;border-radius:50%;background:${primary};opacity:0.07;"></div>
  <div style="position:absolute;top:72px;left:50%;transform:translateX(-50%);width:${circleSize}px;height:${circleSize}px;border-radius:50%;overflow:hidden;border:8px solid ${primary};box-shadow:0 16px 56px rgba(0,0,0,0.45);">
    <img src="${celebrantPhotoDataUrl}" alt="${personName}" style="width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  </div>
  <div style="position:absolute;top:${72 + circleSize + 28}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 80px;">
    <div style="font-size:46px;line-height:1;">🎂</div>
    <p style="color:${primary};font-size:17px;font-weight:900;letter-spacing:6px;text-transform:uppercase;margin:0;">HAPPY BIRTHDAY</p>
    <h1 style="font-size:${nameFz}px;font-weight:900;color:#ffffff;line-height:1.0;margin:0;letter-spacing:-2px;text-align:center;">${personName}</h1>
    ${personRole ? `<p style="color:${primary};font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;">${personRole}</p>` : ""}
    <div style="width:60px;height:3px;background:${primary};border-radius:2px;margin:2px 0;"></div>
    <p style="color:#ffffffCC;font-size:19px;line-height:1.5;margin:0;max-width:700px;text-align:center;">${message}</p>
  </div>
  ${barHtml}
</div>`;
  }

  return `${FONT_IMPORT}<div style="width:1080px;height:1080px;position:relative;overflow:hidden;font-family:${FONT_STACK};box-sizing:border-box;text-align:center;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  <div style="position:absolute;inset:0;background:linear-gradient(to top,${secondary}F5 0%,${secondary}CC 30%,${secondary}80 60%,rgba(0,0,0,0.15) 100%);"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:80px;gap:20px;">
    <div style="font-size:72px;line-height:1;">&#127881;</div>
    <p style="color:${primary};font-size:19px;font-weight:900;letter-spacing:5px;text-transform:uppercase;margin:0;font-family:${FONT_STACK};">HAPPY BIRTHDAY</p>
    <h1 style="font-size:${nameFz}px;font-weight:900;color:#ffffff;line-height:1.0;margin:0;letter-spacing:-1.5px;font-family:${FONT_STACK};">${personName}</h1>
    ${personRole ? `<p style="color:${primary};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;font-family:${FONT_STACK};">${personRole}</p>` : ""}
    <div style="width:64px;height:3px;background:${primary};border-radius:2px;margin:2px 0;"></div>
    <p style="color:rgba(255,255,255,0.88);font-size:24px;line-height:1.6;margin:0;max-width:780px;font-family:${FONT_STACK};">${message}</p>
  </div>
  ${barHtml}
</div>`;
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────
router.post("/generate/testimonial", async (req, res): Promise<void> => {
  const { brandId, testimonialText, customerName, customerRole, rating = 5, format = "square", showBrandName = true, logoPosition = "bottom-center", contactInfo = {}, customPhotoDataUrl, smoothFace = false } = req.body;
  if (!brandId || !testimonialText) { res.status(400).json({ error: "brandId and testimonialText required" }); return; }
  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };
  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const aspectHint = format === "story" ? "portrait 9:16 vertical format" : format === "portrait" ? "portrait 4:5 format" : "square format";
  const testimScene = `happy satisfied ${brand.industry ?? "business"} customer, ${brand.city ?? brand.country ?? "African city"}, warm professional environment, smiling person`;
  const testimFluxPrompt = buildDNAFluxPrompt({ scene: testimScene, ctx: brandCtx, mood: "warm trustworthy", aspectHint, postType: "testimonial" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, "professional team satisfied customer"), w, h, testimFluxPrompt);
  const html = buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, smoothFace });
  res.json({ html });
});

function buildTestimonialHtml({ testimonialText, customerName, customerRole, rating, brandName, colors, format, showBrandName, logoUrl, photoUrl, logoPosition = "bottom-center", contactInfo = {}, smoothFace = false }: {
  testimonialText: string; customerName?: string; customerRole?: string; rating: number;
  brandName: string; colors: string[]; format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean;
}) {
  const primary   = colors[0] ?? "#D97706";
  const secondary = colors[1] ?? "#1C1917";
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const dims = `width:1080px;height:${h}px`;
  const stars = Array.from({ length: 5 }, (_, i) => `<span style="color:${i < rating ? primary : "#ffffff38"};font-size:38px;">&#9733;</span>`).join("");

  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:38px;max-width:140px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#ffffffCC;font-family:${FONT_STACK};">${brandName}</span>`;

  const initials = customerName ? customerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "";
  const ts = testimonialText.length > 150 ? 32 : testimonialText.length > 90 ? 38 : 44;
  const barHtml = brandBar({ showBrandName, logoEl, logoPosition, bg: secondary, ci: contactInfo, padH: 80, padV: 28 });

  return `${FONT_IMPORT}<div style="${dims};position:relative;overflow:hidden;font-family:${FONT_STACK};box-sizing:border-box;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  <div style="position:absolute;inset:0;background:linear-gradient(to top,${secondary}F8 0%,${secondary}E0 30%,${secondary}90 60%,rgba(0,0,0,0.20) 100%);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${primary};"></div>
  <div style="position:absolute;inset:6px 0 0 0;display:flex;flex-direction:column;justify-content:center;padding:80px 86px;gap:24px;">
    <div style="display:flex;gap:3px;">${stars}</div>
    <div style="font-size:100px;color:${primary};line-height:0.5;opacity:0.50;font-family:Georgia,serif;">&ldquo;</div>
    <p style="color:#ffffff;font-size:${ts}px;font-weight:600;line-height:1.55;margin:0;font-family:${FONT_STACK};">${testimonialText}&rdquo;</p>
    ${customerName ? `<div style="display:flex;align-items:center;gap:20px;margin-top:8px;">
      <div style="width:64px;height:64px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="color:#fff;font-size:24px;font-weight:700;font-family:${FONT_STACK};">${initials}</span>
      </div>
      <div>
        <p style="color:#fff;font-size:24px;font-weight:700;margin:0;font-family:${FONT_STACK};">${customerName}</p>
        ${customerRole ? `<p style="color:rgba(255,255,255,0.65);font-size:20px;margin:4px 0 0;font-family:${FONT_STACK};">${customerRole}</p>` : ""}
      </div>
    </div>` : ""}
  </div>
  ${barHtml}
</div>`;
}

// ─── Ad Creative Generation ───────────────────────────────────────────────────

router.post("/generate/ad-creative", async (req, res): Promise<void> => {
  const {
    brandId, platform = "meta", adFormat = "feed",
    headline, tagline, cta, offerText,
    showBrandName = true, customPhotoDataUrl,
  } = req.body;

  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }

  const [[brand], [prefs], [dna]] = await Promise.all([
    db.select().from(brandsTable).where(eq(brandsTable.id, brandId)),
    db.select().from(brandVisualPrefsTable).where(eq(brandVisualPrefsTable.brandId, brandId)),
    db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)),
  ]);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const logoUrl = prefs?.logoUrl ?? null;
  const brandCtx: BrandImageContext = {
    brandName: brand.name, industry: brand.industry, country: brand.country, city: brand.city,
    targetMarket: brand.targetMarket, brandBrief: brand.brandBrief, colors,
    designStyle: prefs?.designStyle,
    toneOfVoice: dna?.toneOfVoice, targetAudience: dna?.targetAudience,
    brandPersonality: dna?.brandPersonality, culturalContext: dna?.culturalContext,
    coreValues: dna?.coreValues, uniqueSellingPoints: dna?.uniqueSellingPoints, keyMessages: dna?.keyMessages,
  };

  let finalHeadline = headline || "";
  let finalTagline  = tagline  || "";
  let finalCta      = cta      || "Learn More";
  let imageScene    = `${brand.industry ?? "business"} lifestyle advertising scene, ${brand.city ?? brand.country ?? "African city"}, ${offerText ? offerText + " product in use" : "professional brand moment"}`;

  try {
    if (hasAI()) {
      const result = await aiJSON<{ headline: string; tagline: string; cta: string; imageScene: string }>(
        `You are a high-converting ad copywriter for African brands on digital platforms.
Write short, punchy ad copy that stops the scroll.
Platform: ${platform}. Format: ${adFormat}. Location: ${brand.city ?? brand.country ?? "Nigeria"}.
NEVER use em dashes.

Return JSON:
{
  "headline": "string (5-9 words, bold hook - the first thing they read)",
  "tagline": "string (8-14 words, value proposition)",
  "cta": "string (2-4 words, action-driven)",
  "imageScene": "string (10-15 words: a specific photorealistic scene for this ad — product in use, location, lighting, mood — no text)"
}`,
        `Brand: ${brand.name} (${brand.industry ?? "business"}, ${brand.city ?? brand.country ?? "Nigeria"}).
Offer / product: ${offerText || "their product or service"}.
${headline ? `Existing headline: ${headline} (improve it slightly)` : "Write a fresh headline."}`,
        350,
      );
      if (result?.headline) finalHeadline = result.headline;
      if (result?.tagline)  finalTagline  = result.tagline;
      if (result?.cta)      finalCta      = cta || result.cta;
      if (result?.imageScene) imageScene  = result.imageScene;
    }
  } catch { /* fall through to defaults */ }

  const isStory  = adFormat === "story";
  const isBanner = adFormat === "banner";
  const w = isBanner ? 1200 : 1080;
  const h = isStory  ? 1920 : isBanner ? 628 : 1080;

  const adAspectHint = isStory ? "portrait 9:16 vertical format" : isBanner ? "landscape wide banner format" : "square format";
  const adFluxPrompt = buildDNAFluxPrompt({ scene: imageScene, ctx: brandCtx, mood: "bold impactful advertising", aspectHint: adAspectHint, postType: "ad-creative" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, offerText || brand.name), w, h, adFluxPrompt);
  const html = buildAdCreativeHtml({
    headline: finalHeadline, tagline: finalTagline, cta: finalCta,
    brandName: brand.name, colors, adFormat, showBrandName, logoUrl, photoUrl, platform,
  });

  await db.insert(generatedDesignsTable).values({
    brandId,
    userId: (req as any).user?.id ?? brandId,
    designType: "ad_creative",
    platform,
    title: `${platform.toUpperCase()} Ad - ${finalHeadline.slice(0, 50)}`,
    promptUsed: offerText || "",
    imageUrls: [],
  }).catch(() => {});

  res.json({ html, headline: finalHeadline, tagline: finalTagline, cta: finalCta });
});

function buildAdCreativeHtml({ headline, tagline, cta, brandName, colors, adFormat, showBrandName, logoUrl, photoUrl, platform }: {
  headline: string; tagline: string; cta: string;
  brandName: string; colors: string[]; adFormat: string;
  showBrandName: boolean; logoUrl?: string | null; photoUrl: string; platform: string;
}) {
  const [primary, secondary] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917"];
  const isStory  = adFormat === "story";
  const isBanner = adFormat === "banner";

  const dims     = isStory ? "width:1080px;height:1920px" : isBanner ? "width:1200px;height:628px" : "width:1080px;height:1080px";
  const w        = isBanner ? 1200 : 1080;
  const h        = isStory  ? 1920 : isBanner ? 628 : 1080;

  const hs = headline.length > 40 ? 56 : headline.length > 24 ? 72 : 88;
  const ts = h === 1920 ? 38 : 28;

  const logoEl = logoUrl
    ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:${isStory ? 44 : 36}px;max-width:150px;object-fit:contain;filter:brightness(0) invert(1);" />`
    : `<span style="font-size:${isStory ? 16 : 13}px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#fff;">${brandName}</span>`;

  const platformLabel = { meta: "Facebook / Instagram", tiktok: "TikTok", google: "Google Display", snapchat: "Snapchat" }[platform] ?? platform;

  // ── Banner layout: split panel ──────────────────────────────────────────────
  if (isBanner) {
    const panelW = Math.round(w * 0.42);
    return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;display:flex;">
  <div style="width:${panelW}px;flex-shrink:0;background:${secondary};display:flex;flex-direction:column;justify-content:center;padding:40px 44px;gap:18px;">
    ${showBrandName ? `<div style="margin-bottom:4px;">${logoEl}</div>` : ""}
    <h1 style="font-size:${headline.length > 30 ? 36 : 46}px;font-weight:900;color:#ffffff;margin:0;line-height:1.1;letter-spacing:-1px;">${headline}</h1>
    <p style="font-size:22px;color:#ffffffBB;margin:0;line-height:1.4;">${tagline}</p>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;background:${primary};border-radius:100px;margin-top:4px;width:fit-content;">
      <span style="font-size:20px;font-weight:700;color:#fff;">${cta} &#8594;</span>
    </div>
    <p style="font-size:13px;color:#ffffff55;margin:0;">Sponsored</p>
  </div>
  <div style="flex:1;position:relative;overflow:hidden;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;" />
    <div style="position:absolute;inset:0;background:linear-gradient(to right,${secondary}40 0%,transparent 40%);"></div>
  </div>
</div>`;
  }

  // ── Story / Reel layout (9:16) ───────────────────────────────────────────────
  if (isStory) {
    return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0) 25%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.75) 75%,rgba(0,0,0,0.92) 100%);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${primary};"></div>
  ${showBrandName ? `<div style="position:absolute;top:52px;left:52px;display:flex;align-items:center;gap:12px;">
    <div style="width:52px;height:52px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;overflow:hidden;">
      ${logoUrl ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:20px;font-weight:800;color:#fff;">${brandName[0]}</span>`}
    </div>
    <div>
      <p style="color:#fff;font-size:22px;font-weight:700;margin:0;line-height:1;">${brandName}</p>
      <p style="color:#ffffffAA;font-size:16px;margin:2px 0 0;">Sponsored</p>
    </div>
  </div>` : ""}
  <div style="position:absolute;bottom:180px;left:64px;right:64px;">
    <h1 style="font-size:${hs}px;font-weight:900;color:#ffffff;margin:0 0 24px;line-height:1.05;text-shadow:2px 4px 20px rgba(0,0,0,0.6);">${headline}</h1>
    <p style="font-size:${ts}px;color:#ffffffCC;margin:0 0 32px;line-height:1.5;">${tagline}</p>
    <div style="display:inline-flex;align-items:center;gap:10px;padding:20px 40px;background:${primary};border-radius:100px;">
      <span style="font-size:28px;font-weight:700;color:#fff;">${cta} &#8594;</span>
    </div>
  </div>
</div>`;
  }

  // ── Feed / Square (1:1 default) ──────────────────────────────────────────────
  const cardH = Math.round(h * 0.38);
  return `<div style="${dims};position:relative;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:${h - cardH + 60}px;object-fit:cover;object-position:center;" />
  <div style="position:absolute;top:0;left:0;right:0;height:${h - cardH + 60}px;background:linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(245,245,245,1) 100%);"></div>
  ${showBrandName ? `<div style="position:absolute;top:36px;left:36px;background:rgba(0,0,0,0.48);padding:8px 16px;border-radius:8px;display:flex;align-items:center;gap:10px;">
    ${logoEl}
  </div>` : ""}
  <div style="position:absolute;top:36px;right:36px;background:rgba(0,0,0,0.48);padding:6px 14px;border-radius:6px;">
    <span style="font-size:18px;font-weight:600;color:#ffffffAA;">Sponsored</span>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:${cardH}px;background:#ffffff;border-radius:24px 24px 0 0;padding:36px 48px 32px;border-top:6px solid ${primary};">
    <h1 style="font-size:${hs}px;font-weight:900;color:${secondary};margin:0 0 12px;line-height:1.1;">${headline}</h1>
    <p style="font-size:${ts}px;color:#555;margin:0 0 22px;line-height:1.4;">${tagline}</p>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:${primary};border-radius:100px;">
      <span style="font-size:22px;font-weight:700;color:#fff;">${cta} &#8594;</span>
    </div>
  </div>
</div>`;
}

export default router;
