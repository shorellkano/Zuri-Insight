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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  const [primary, bg, text] = [colors[0] ?? "#0D6B8C", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
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
  const [primary, bg, text] = [colors[0] ?? "#0D6B8C", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
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
const ANN_FONT_IMPORT  = `<style>@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600;700&display=swap');</style>`;
const OSWALD_IMPORT    = `<style>@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Source+Sans+3:wght@400;600&display=swap');</style>`;
const PLAYFAIR_IMPORT  = `<style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Lato:wght@400;700&display=swap');</style>`;
const RALEWAY_IMPORT   = `<style>@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');</style>`;

// ─── Shared brand mark helper ─────────────────────────────────────────────────
function brandMark({ showBrandName, logoUrl, brandName, primary, dark = true }: {
  showBrandName: boolean; logoUrl?: string | null; brandName: string; primary: string; dark?: boolean;
}): string {
  if (!showBrandName) return "";
  if (logoUrl) {
    const f = dark ? "filter:brightness(0) invert(1);" : "";
    return `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:64px;max-width:220px;object-fit:contain;${f}" />`;
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
 * Build a FLUX.1-dev prompt using photography-first language.
 * FLUX responds to camera/lighting/subject descriptions, not abstract brand concepts.
 */
function buildDNAFluxPrompt(opts: {
  scene: string;          // AI-generated scene: "photograph of [subject] doing [action] in [place]"
  ctx: BrandImageContext;
  mood?: string;
  aspectHint?: string;
  postType?: string;
}): string {
  const { scene, ctx, aspectHint = "square format" } = opts;

  // ── Location ──
  const city = ctx.city ?? ctx.country ?? "Lagos, Nigeria";

  // ── Lighting from design style (no bokeh — sharp focus is required for SDXL) ──
  const lightingMap: Record<string, string> = {
    "bold":         "dramatic studio lighting, strong key light, deep crisp shadows, sharp",
    "minimal":      "bright even window light, clean white tones, bright airy, sharp focus",
    "professional": "professional soft-box lighting, even exposure, crisp sharp detail",
    "warm":         "warm golden afternoon sunlight, inviting glow, sharp focus, vivid",
    "luxury":       "moody cinematic lighting, rich shadows, sharp detail, premium feel",
    "playful":      "bright cheerful natural sunlight, vivid saturated colors, sharp",
    "modern":       "cool blue-white studio light, sleek contemporary, sharp clinical detail",
  };
  const lighting = lightingMap[ctx.designStyle ?? "professional"] ?? "professional soft-box lighting, even exposure, crisp detail";

  // ── Camera specs for realism ──
  const cameraMap: Record<string, string> = {
    "bold":         "Sony A7 III, 35mm f/1.4, slightly underexposed",
    "minimal":      "Canon EOS R5, 50mm f/2.0, overexposed +1 stop",
    "professional": "Canon 5D Mark IV, 85mm f/2.0, clean background",
    "warm":         "Nikon D850, 85mm f/1.8, warm color grade",
    "luxury":       "Hasselblad X2D, 90mm f/2.2, medium format detail",
    "playful":      "Canon EOS R6, 35mm f/2.0, vibrant color grade",
    "modern":       "Sony A9 II, 70mm f/1.8, sharp and clinical",
  };
  const camera = cameraMap[ctx.designStyle ?? "professional"] ?? "Canon 5D Mark IV, 85mm f/2.0";

  // ── Brand accent color for clothing/props ──
  const primaryColorName = hexToColorName(ctx.colors[0] ?? "#0097A7");

  // ── Subject context from industry ──
  const subjectMap: Record<string, string> = {
    "Food & Beverage":              "West African chef or food vendor, delicious food presentation",
    "Health & Wellness":            "fit African woman doing wellness activity, healthy lifestyle",
    "Healthcare & Medical":         "Nigerian medical professional in scrubs, modern clinic",
    "Beauty & Personal Care":       "stylish African woman in beauty salon, cosmetics and skincare",
    "Fashion & Apparel":            "confident Nigerian model in fashionable outfit, editorial pose",
    "Technology & SaaS":            "young African tech professional at laptop, modern office",
    "Real Estate & Property":       "elegant Nigerian professional in luxury interior, modern home",
    "Education & Training":         "engaged Nigerian students in bright classroom, learning",
    "Entertainment & Events":       "joyful African crowd at vibrant event, celebration energy",
    "Travel & Hospitality":         "smiling Nigerian guest at premium hotel, luxury travel",
    "Agriculture & Farming":        "Nigerian farmer with fresh produce, golden farmland",
    "Retail & E-commerce":          "happy Nigerian customer shopping, beautiful retail display",
    "Fintech & Payments":           "confident Nigerian professional with smartphone, fintech",
    "Logistics & Courier":          "professional Nigerian delivery worker, urban cityscape",
    "Construction & Engineering":   "Nigerian engineer at modern construction site, hard hat",
    "Non-profit & NGO":             "smiling Nigerian community members, empowerment scene",
    "Church & Religious Organisation": "joyful Nigerian congregation, uplifting atmosphere",
    "Domestic Staffing & Caregiving": "smiling Nigerian caregiver in uniform caring for family, warm home",
  };
  const subjectCtx = subjectMap[ctx.industry ?? ""] ?? "confident Nigerian professional, modern setting";

  // ── Strip "photograph of" prefix from the AI scene so we can lead with person ──
  const sceneEnv = scene.replace(/^photograph of\s*/i, "").trim();

  // ── Inject brand color into the person description so FLUX paints the right uniform ──
  const subjectWithColor = subjectCtx.replace(
    /\bin uniform\b/i, `in ${primaryColorName} professional uniform`
  ).replace(
    /\bin (a |the )?uniform\b/i, `in ${primaryColorName} professional uniform`
  );
  // If no "uniform" in description, append the color clothing hint
  const coloredSubject = subjectWithColor !== subjectCtx
    ? subjectWithColor
    : `${subjectCtx}, wearing ${primaryColorName} uniform`;

  // ── Assemble: PERSON FIRST so FLUX renders the subject, not the background ──
  // Format: "professional photograph of [person with color uniform], [scene/action], [city], [lighting], [camera], [quality]"
  const parts = [
    `professional photograph of ${coloredSubject}`,
    sceneEnv,
    city,
    lighting,
    camera,
    "sharp focus, hyperrealistic, ultra-detailed skin and fabric texture, 8k uhd, natural skin tones, magazine editorial photography, professional commercial photography, Nikon D850 RAW, vivid colors, no CGI, no 3D render",
    "no text, no watermark, no logos, no overlay",
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Fetch any image URL and return it as a base64 data URL so it never expires.
 */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const mime = resp.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Get a photo — tries Together AI FLUX first, falls back to Unsplash.
 * Always returns an embedded base64 data URL so images never expire.
 */
async function resolvePhotoUrl(query: string, w: number, h: number, fluxPrompt?: string): Promise<string> {
  // 1. Try FLUX.1 AI image generation (already returns base64)
  if (hasImageAI() && fluxPrompt) {
    try {
      // Always portrait orientation for person photography — FLUX renders people
      // far better in 3:4 portrait than square/landscape. Banner canvases are the exception.
      const isWide = w > h * 1.3;
      const fluxW = isWide ? 1024 : 768;
      const fluxH = isWide ? 576  : 1024;
      const dataUrl = await generateImage({ prompt: fluxPrompt, width: fluxW, height: fluxH, steps: 20 });
      console.log(`[ImageAI] FLUX generated ${fluxW}x${fluxH} image`);
      return dataUrl;
    } catch (err: any) {
      console.warn(`[ImageAI] FLUX failed, falling back to Unsplash: ${err.message}`);
    }
  }

  // 2. Unsplash fallback — fetch and embed as base64 so it doesn't expire
  const q = query.trim().replace(/\s+/g, ",");
  const sourceUrl = `https://source.unsplash.com/featured/${w}x${h}/?${encodeURIComponent(q)}`;
  const dataUrl = await fetchAsDataUrl(sourceUrl);
  if (dataUrl) return dataUrl;

  // 3. Last resort: return the external URL (will still render if network is up)
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  let features: { emoji: string; label: string }[] = [];
  let callout = "";
  let imageScene = `${brand.name} ${brand.industry ?? "business"} announcement launch event, ${brand.city ?? brand.country ?? "African city"} setting, outdoor or modern venue`;
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a brand copywriter for African businesses. Create high-impact Instagram post copy.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. Location: ${brand.city ?? brand.country ?? "Nigeria"}.
Announcement details: ${eventDetails || "General announcement — make something exciting"}

Return JSON with these exact keys:
{
  "headline": "string — 3-7 words max, bold emotional hook, sentence case. Examples: 'Need a caring hand, fast?' / 'Meet our team of experts' / 'Trusted care, delivered fast'",
  "subtext": "string — 2-3 sentences. Key facts/numbers from the announcement. Warm, direct tone.",
  "cta": "string — max 4 words, action verb first. Examples: 'Book a caregiver today' / 'Get started now' / 'Find your perfect match'",
  "features": [
    {
      "emoji": "single relevant emoji",
      "label": "2-4 words, UPPERCASE — the benefit title",
      "description": "one sentence, max 12 words — brief supporting detail"
    }
  ],
  "callout": "string — 10-16 words, the single most compelling reason to act now",
  "imageScene": "string: start with 'photograph of' then describe: specific African person + action + setting + lighting. Keep the person wearing the brand's uniform/colors. Example: 'photograph of smiling Nigerian caregiver in teal uniform helping elderly woman, bright modern Lagos home, warm natural light'"
}
Rules: 3-5 features. Each feature needs emoji + label + description. Never use em dashes. Headline must be short and punchy — 3-7 words only.`, "{}");
      if (result.headline) headline = result.headline;
      if (result.subtext) subtext = result.subtext;
      if (result.cta) cta = ctaText || result.cta;
      if (Array.isArray(result.features)) features = result.features.slice(0, 5);
      if (result.callout) callout = result.callout;
      if (result.imageScene) imageScene = result.imageScene;
    }
  } catch { }

  const w = 1080, h = format === "story" ? 1920 : format === "portrait" ? 1350 : 1080;
  const aspectHint = format === "story" ? "portrait 9:16 vertical format" : format === "portrait" ? "portrait 4:5 format" : "square format";
  const fluxPrompt = buildDNAFluxPrompt({ scene: imageScene, ctx: brandCtx, aspectHint, postType: "announcement" });
  const photoUrl = customPhotoDataUrl || await resolvePhotoUrl(industryPhotoQuery(brand.industry, "announcement launch event outdoor"), w, h, fluxPrompt);
  const html = buildAnnouncementHtml({ headline, subtext, cta, features, callout, brandName: brand.name, colors, format, showBrandName, logoUrl, photoUrl, logoPosition, contactInfo, smoothFace, designStyle: prefs?.designStyle ?? "professional" });
  res.json({ html, headline, subtext, cta });
});

function buildAnnouncementHtml({ headline, subtext, cta, features = [], callout = "", brandName, colors, format, showBrandName, logoUrl, photoUrl, logoPosition = "bottom-center", contactInfo = {}, smoothFace = false, designStyle = "professional" }: {
  headline: string; subtext: string; cta: string;
  features?: { emoji: string; label: string; description?: string }[];
  callout?: string;
  brandName: string; colors: string[];
  format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean; designStyle?: string;
}) {
  const primary    = colors[0] ?? "#0097A7";
  const secondary  = colors[1] ?? "#1C1917";
  const isStory    = format === "story";
  const isPortrait = format === "portrait";
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const hl = headline.length;
  const H_FONT = `'Barlow Condensed','Arial Narrow','Impact',sans-serif`;
  const B_FONT = `'Barlow','Trebuchet MS','Segoe UI',sans-serif`;

  const primaryIsLight = isLightColor(primary);
  const onPrimary = primaryIsLight ? "#1a1a1a" : "#ffffff";
  const websiteUrl = (contactInfo as Record<string, string>).website ?? "";

  // ── Logo element (works on white bg) ─────────────────────────────────────────
  const logoEl = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:72px;max-width:240px;object-fit:contain;" />`
        : `<div style="display:flex;align-items:center;gap:12px;">
             <div style="width:52px;height:52px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <span style="color:${onPrimary};font-size:22px;font-weight:900;font-family:${FONT_STACK};">${brandName.charAt(0).toUpperCase()}</span>
             </div>
             <span style="color:${secondary};font-size:20px;font-weight:700;font-family:${FONT_STACK};">${brandName}</span>
           </div>`)
    : "";

  // ── Feature bullet rows: FILLED brand-color circle + bold label + description ──
  const featureBulletsHtml = features.length > 0
    ? features.slice(0, 4).map(f =>
        `<div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
          <div style="width:46px;height:46px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;line-height:1;">${f.emoji}</div>
          <div style="padding-top:4px;">
            <p style="margin:0 0 5px;font-size:17px;font-weight:800;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.6px;font-family:${H_FONT};">${f.label}</p>
            ${f.description ? `<p style="margin:0;font-size:15px;color:#444;line-height:1.5;font-family:${B_FONT};">${f.description}</p>` : ""}
          </div>
        </div>`
      ).join("")
    : "";

  // ── Feature grid for Story (horizontal, 2-col) ────────────────────────────────
  const featureGridHtml = features.length > 0
    ? features.slice(0, 4).map(f =>
        `<div style="display:flex;align-items:flex-start;gap:18px;min-width:260px;flex:1;">
          <div style="width:56px;height:56px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:26px;">${f.emoji}</div>
          <div>
            <p style="margin:0 0 5px;font-size:21px;font-weight:800;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.5px;font-family:${H_FONT};">${f.label}</p>
            ${f.description ? `<p style="margin:0;font-size:18px;color:#444;line-height:1.4;font-family:${B_FONT};">${f.description}</p>` : ""}
          </div>
        </div>`
      ).join("")
    : "";

  // ── CTA button with calendar icon ────────────────────────────────────────────
  const calIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${onPrimary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const ctaButtonHtml = cta
    ? `<div style="width:100%;background:${primary};border-radius:10px;padding:15px 20px;box-sizing:border-box;display:flex;align-items:center;gap:14px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.18);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${calIconSvg}</div>
        <span style="flex:1;color:${onPrimary};font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-family:${H_FONT};">${cta}</span>
        <span style="color:${onPrimary};font-size:22px;font-weight:700;">&#8594;</span>
      </div>`
    : "";

  // ── Footer bar: SVG icon badges + website ─────────────────────────────────────
  function footerBar(padH = 44, h = 100, fz = 15): string {
    const ic = (svg: string) =>
      `<div style="width:36px;height:36px;border-radius:50%;border:2px solid ${onPrimary}88;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${svg}</div>`;
    const shieldSvg = ic(`<svg xmlns="http://www.w3.org/2000/svg" width="17" height="19" viewBox="0 0 24 28" fill="none"><path d="M12 2L4 6v8c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2z" stroke="${onPrimary}" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 14l2 2 4-4" stroke="${onPrimary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    const heartSvg = ic(`<svg xmlns="http://www.w3.org/2000/svg" width="19" height="18" viewBox="0 0 24 22" fill="none"><path d="M12 20S3 14 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12z" stroke="${onPrimary}" stroke-width="2.2" stroke-linejoin="round"/></svg>`);
    const globeSvg = ic(`<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="${onPrimary}" stroke-width="2"/><path d="M12 3c-2.5 3-4 5.8-4 9s1.5 6 4 9M12 3c2.5 3 4 5.8 4 9s-1.5 6-4 9M3 12h18" stroke="${onPrimary}" stroke-width="1.8"/></svg>`);
    const badges = [
      { icon: shieldSvg, label: "TRUSTED CARE" },
      { icon: heartSvg, label: "PEACE OF MIND" },
    ];
    const badgesHtml = badges.map(b =>
      `<div style="display:flex;align-items:center;gap:10px;">
        ${b.icon}
        <span style="color:${onPrimary};font-size:${fz}px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;font-family:${FONT_STACK};">${b.label}</span>
      </div>`
    ).join(`<div style="width:1px;height:32px;background:${onPrimary}55;margin:0 8px;"></div>`);
    const websiteHtml = websiteUrl
      ? `<div style="display:flex;align-items:center;gap:10px;">
          ${globeSvg}
          <span style="color:${onPrimary};font-size:${fz}px;font-weight:700;font-family:${FONT_STACK};">${websiteUrl}</span>
        </div>`
      : "";
    return `<div style="height:${h}px;background:${primary};flex-shrink:0;display:flex;align-items:center;padding:0 ${padH}px;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:24px;">${badgesHtml}</div>
      ${websiteHtml}
    </div>`;
  }

  // ── Callout accent strip ──────────────────────────────────────────────────────
  const calloutStripHtml = callout
    ? `<div style="background:${primary}15;border-left:5px solid ${primary};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:14px;flex-shrink:0;">
        <p style="margin:0;font-size:16px;font-weight:600;color:${secondary};line-height:1.5;font-family:${FONT_STACK};">${callout}</p>
      </div>`
    : "";

  // ── Layout variant: deterministic (same headline → same design, different headline → different design) ──
  const _varHash = headline.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 0);
  const sqVariant = _varHash % 4;   // 0-3 for square
  const stVariant = _varHash % 2;   // 0-1 for story
  const ptVariant = _varHash % 2;   // 0-1 for portrait
  // Font pair rotates with layout so each variant has its own typographic personality
  const FONT_PAIRS = [
    { fi: ANN_FONT_IMPORT, H: H_FONT, B: B_FONT },
    { fi: OSWALD_IMPORT,   H: `'Oswald','Impact','Arial Narrow',sans-serif`,           B: `'Source Sans 3','Source Sans Pro','Segoe UI',sans-serif` },
    { fi: PLAYFAIR_IMPORT, H: `'Playfair Display','Georgia','Times New Roman',serif`,  B: `'Lato','Helvetica Neue','Arial',sans-serif` },
    { fi: RALEWAY_IMPORT,  H: `'Raleway','Trebuchet MS','Arial',sans-serif`,            B: `'Nunito Sans','Segoe UI','Helvetica',sans-serif` },
  ];
  const fp = FONT_PAIRS[sqVariant];

  // ── Logo adapted for primary-colored backgrounds ───────────────────────────────
  const logoElOnPrimary = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:72px;max-width:240px;object-fit:contain;${primaryIsLight ? '' : 'filter:brightness(0) invert(1);'}" />`
        : `<div style="display:flex;align-items:center;gap:12px;">
             <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.45);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <span style="color:${onPrimary};font-size:22px;font-weight:900;font-family:${FONT_STACK};">${brandName.charAt(0).toUpperCase()}</span>
             </div>
             <span style="color:${onPrimary};font-size:20px;font-weight:700;font-family:${FONT_STACK};">${brandName}</span>
           </div>`)
    : "";

  // ── Feature bullets on primary-colored panels ────────────────────────────────
  const featureBulletsOnPrimaryHtml = features.length > 0
    ? features.slice(0, 4).map(f =>
        `<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
          <div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;line-height:1;">${f.emoji}</div>
          <div style="padding-top:3px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:${onPrimary};text-transform:uppercase;letter-spacing:0.6px;font-family:${fp.H};">${f.label}</p>
            ${f.description ? `<p style="margin:0;font-size:14px;color:${onPrimary}BB;line-height:1.4;font-family:${fp.B};">${f.description}</p>` : ""}
          </div>
        </div>`
      ).join("")
    : "";

  // ── Feature grid for story on primary background ──────────────────────────────
  const featureGridOnPrimaryHtml = features.length > 0
    ? features.slice(0, 4).map(f =>
        `<div style="display:flex;align-items:flex-start;gap:16px;min-width:240px;flex:1;">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px;">${f.emoji}</div>
          <div>
            <p style="margin:0 0 4px;font-size:19px;font-weight:800;color:${onPrimary};text-transform:uppercase;letter-spacing:0.5px;font-family:${fp.H};">${f.label}</p>
            ${f.description ? `<p style="margin:0;font-size:16px;color:${onPrimary}BB;line-height:1.4;font-family:${fp.B};">${f.description}</p>` : ""}
          </div>
        </div>`
      ).join("")
    : "";

  // ── Ghost CTA for primary-colored panels ─────────────────────────────────────
  const ctaButtonAltHtml = cta
    ? `<div style="width:100%;background:rgba(255,255,255,0.14);border:2px solid rgba(255,255,255,0.45);border-radius:10px;padding:14px 20px;box-sizing:border-box;display:flex;align-items:center;gap:14px;">
        <span style="flex:1;color:${onPrimary};font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-family:${fp.H};">${cta}</span>
        <span style="color:${onPrimary};font-size:22px;font-weight:700;">&#8594;</span>
      </div>`
    : "";

  // ── STORY variant 1: cinematic — photo hero top, dark text panel bottom ────────
  if (isStory && stVariant === 1) {
    const stHFz = hl > 60 ? 56 : hl > 40 ? 68 : hl > 25 ? 80 : 94;
    return `${fp.fi}<div style="width:1080px;height:1920px;font-family:${fp.B};overflow:hidden;box-sizing:border-box;position:relative;background:#0a0a0a;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:66%;object-fit:cover;object-position:center top;${smoothStyle}" />
  <div style="position:absolute;top:0;left:0;right:0;height:66%;background:linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 40%, rgba(0,0,0,0.50) 100%);"></div>
  ${showBrandName ? `<div style="position:absolute;top:52px;left:52px;background:rgba(255,255,255,0.95);padding:10px 22px;border-radius:100px;box-shadow:0 3px 16px rgba(0,0,0,0.18);">${logoEl}</div>` : ""}
  <div style="position:absolute;left:0;right:0;bottom:0;height:34%;background:#0a0a0a;display:flex;flex-direction:column;justify-content:space-between;padding:36px 52px 0;box-sizing:border-box;">
    <div style="display:flex;flex-direction:column;gap:16px;flex:1;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:14px;flex-shrink:0;">
        <div style="width:6px;height:44px;background:${primary};border-radius:3px;flex-shrink:0;"></div>
        <h1 style="font-size:${stHFz}px;font-weight:900;color:#ffffff;line-height:1.0;margin:0;letter-spacing:-0.5px;font-family:${fp.H};text-transform:uppercase;">${headline}</h1>
      </div>
      <p style="font-size:24px;color:rgba(255,255,255,0.75);line-height:1.55;margin:0;flex-shrink:0;font-family:${fp.B};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${features.slice(0, 3).map(f => `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"><span style="font-size:22px;">${f.emoji}</span><span style="color:rgba(255,255,255,0.85);font-size:19px;font-weight:700;font-family:${fp.H};text-transform:uppercase;">${f.label}</span></div>`).join("")}</div>
    </div>
    <div style="border-top:2px solid ${primary};margin:0 -52px;padding:20px 52px;display:flex;align-items:center;gap:20px;">
      <span style="flex:1;color:#ffffff;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-family:${fp.H};">${cta} &#8594;</span>
      ${websiteUrl ? `<span style="color:rgba(255,255,255,0.65);font-size:15px;font-weight:600;font-family:${fp.B};">${websiteUrl}</span>` : ""}
    </div>
  </div>
</div>`;
  }

  // ── STORY: photo top, text + features below ───────────────────────────────────
  if (isStory) {
    const photoH = 840;
    const hFz = hl > 60 ? 50 : hl > 40 ? 60 : hl > 25 ? 70 : 82;
    return `${ANN_FONT_IMPORT}<div style="width:1080px;height:1920px;font-family:${B_FONT};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;background:#ffffff;">
  <div style="width:1080px;height:${photoH}px;overflow:hidden;flex-shrink:0;position:relative;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;${smoothStyle}" />
    ${showBrandName ? `<div style="position:absolute;top:44px;left:44px;background:rgba(255,255,255,0.95);padding:10px 20px;border-radius:100px;box-shadow:0 2px 14px rgba(0,0,0,0.13);">${logoEl}</div>` : ""}
  </div>
  <div style="flex:1;padding:44px 52px 0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
    <div style="width:52px;height:4px;background:${primary};border-radius:2px;margin-bottom:14px;flex-shrink:0;"></div>
    <h1 style="font-size:${hFz}px;font-weight:900;color:${primary};line-height:1.05;margin:0 0 14px;letter-spacing:-0.5px;flex-shrink:0;font-family:${H_FONT};">${headline}</h1>
    <p style="font-size:23px;color:#3a3a3a;line-height:1.68;margin:0 0 24px;flex-shrink:0;font-family:${B_FONT};">${subtext}</p>
    <div style="flex:1;display:flex;flex-wrap:wrap;gap:20px 40px;overflow:hidden;">${featureGridHtml}</div>
  </div>
  <div style="padding:20px 52px 24px;flex-shrink:0;display:flex;flex-direction:column;gap:14px;">
    ${calloutStripHtml}
    ${ctaButtonHtml}
  </div>
  ${footerBar(52, 88, 15)}
</div>`;
  }

  // ── PORTRAIT variant 1: bold primary panel left + full photo right ────────────
  if (isPortrait && ptVariant === 1) {
    const ptHFz = hl > 70 ? 54 : hl > 50 ? 64 : hl > 35 ? 76 : 90;
    return `${fp.fi}<div style="width:1080px;height:1350px;font-family:${fp.B};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="position:relative;flex:1;overflow:hidden;">
    <div style="position:absolute;top:0;right:0;width:600px;bottom:0;overflow:hidden;">
      <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;${smoothStyle}" />
    </div>
    <div style="position:absolute;top:0;left:0;width:480px;bottom:0;background:${primary};padding:52px 44px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
      ${showBrandName ? `<div style="margin-bottom:28px;flex-shrink:0;">${logoElOnPrimary}</div>` : ""}
      <div style="width:50px;height:5px;background:${onPrimary}60;border-radius:3px;margin-bottom:18px;flex-shrink:0;"></div>
      <h1 style="font-size:${ptHFz}px;font-weight:900;color:${onPrimary};line-height:1.0;margin:0 0 16px;letter-spacing:-0.5px;flex-shrink:0;font-family:${fp.H};text-transform:uppercase;">${headline}</h1>
      <p style="font-size:18px;color:${onPrimary}CC;line-height:1.65;margin:0 0 18px;flex-shrink:0;font-family:${fp.B};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${featureBulletsOnPrimaryHtml}</div>
      <div style="flex-shrink:0;margin-top:16px;">${ctaButtonAltHtml}</div>
    </div>
  </div>
  ${footerBar(44, 108, 15)}
</div>`;
  }

  // ── PORTRAIT: text-left + diagonal photo-right, taller canvas ───────────────
  if (isPortrait) {
    const textW = 460;
    const footerH = 108;
    const mainH = 1350 - footerH;
    const hFz = hl > 70 ? 52 : hl > 50 ? 62 : hl > 35 ? 72 : 86;
    return `${ANN_FONT_IMPORT}<div style="width:1080px;height:1350px;font-family:${B_FONT};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="position:relative;flex:1;overflow:hidden;background:#ffffff;">

    <!-- RIGHT PHOTO: diagonal left-edge bleed into text zone -->
    <div style="position:absolute;top:0;right:0;width:680px;height:${mainH}px;overflow:hidden;clip-path:polygon(140px 0,100% 0,100% 100%,0 100%);">
      <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;${smoothStyle}" />
    </div>

    <!-- LEFT TEXT PANEL -->
    <div style="position:absolute;top:0;left:0;width:${textW}px;height:${mainH}px;padding:48px 40px 32px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
      ${showBrandName ? `<div style="margin-bottom:20px;flex-shrink:0;">${logoEl}</div>` : ""}
      <div style="width:52px;height:4px;background:${primary};border-radius:2px;margin-bottom:14px;flex-shrink:0;"></div>
      <h1 style="font-size:${hFz}px;font-weight:900;color:${primary};line-height:1.0;margin:0 0 14px;letter-spacing:-0.5px;flex-shrink:0;font-family:${H_FONT};text-transform:uppercase;">${headline}</h1>
      <p style="font-size:19px;color:#3a3a3a;line-height:1.65;margin:0 0 20px;flex-shrink:0;font-family:${B_FONT};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${featureBulletsHtml}</div>
      <div style="flex-shrink:0;margin-top:14px;">
        ${calloutStripHtml}
        ${ctaButtonHtml}
      </div>
    </div>

  </div>
  ${footerBar(44, 108, 15)}
</div>`;
  }

  // ── SQUARE variant 1: cinematic — photo hero, dark text band at bottom ──────
  if (sqVariant === 1) {
    const sqHFz = hl > 70 ? 52 : hl > 50 ? 62 : hl > 35 ? 74 : 88;
    const textBandH = 340;
    return `${fp.fi}<div style="width:1080px;height:1080px;font-family:${fp.B};overflow:hidden;box-sizing:border-box;position:relative;background:#0a0a0a;">
  <img src="${photoUrl}" crossorigin="anonymous" alt="" style="position:absolute;top:0;left:0;width:100%;height:${1080 - textBandH + 60}px;object-fit:cover;object-position:center top;${smoothStyle}" />
  <div style="position:absolute;top:0;left:0;right:0;height:${1080 - textBandH + 60}px;background:linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.55) 100%);"></div>
  ${showBrandName ? `<div style="position:absolute;top:36px;left:40px;background:rgba(255,255,255,0.95);padding:9px 20px;border-radius:100px;box-shadow:0 2px 14px rgba(0,0,0,0.16);">${logoEl}</div>` : ""}
  <div style="position:absolute;bottom:0;left:0;right:0;height:${textBandH}px;background:#0a0a0a;display:flex;flex-direction:column;justify-content:center;padding:28px 44px;box-sizing:border-box;gap:12px;">
    <div style="display:flex;align-items:flex-start;gap:14px;">
      <div style="width:5px;min-height:${sqHFz * 1.0}px;background:${primary};border-radius:3px;flex-shrink:0;margin-top:4px;"></div>
      <h1 style="font-size:${sqHFz}px;font-weight:900;color:#ffffff;line-height:1.0;margin:0;letter-spacing:-0.5px;font-family:${fp.H};text-transform:uppercase;">${headline}</h1>
    </div>
    <p style="font-size:18px;color:rgba(255,255,255,0.72);line-height:1.55;margin:0;font-family:${fp.B};">${subtext}</p>
    <div style="display:flex;align-items:center;gap:20px;margin-top:4px;">
      <span style="color:${primary};font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-family:${fp.H};">${cta} &#8594;</span>
      ${websiteUrl ? `<span style="margin-left:auto;color:rgba(255,255,255,0.50);font-size:14px;font-weight:600;font-family:${fp.B};">${websiteUrl}</span>` : ""}
    </div>
  </div>
</div>`;
  }

  // ── SQUARE variant 2: stacked — photo top, brand colour panel bottom ─────────
  if (sqVariant === 2) {
    const sqHFz = hl > 70 ? 48 : hl > 50 ? 56 : hl > 35 ? 66 : 78;
    return `${fp.fi}<div style="width:1080px;height:1080px;font-family:${fp.B};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="position:relative;height:390px;flex-shrink:0;overflow:hidden;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 25%;${smoothStyle}" />
    ${showBrandName ? `<div style="position:absolute;top:28px;left:36px;background:rgba(255,255,255,0.95);padding:10px 20px;border-radius:100px;box-shadow:0 2px 14px rgba(0,0,0,0.13);">${logoEl}</div>` : ""}
  </div>
  <div style="flex:1;background:${primary};display:flex;flex-direction:column;overflow:hidden;">
    <div style="flex:1;padding:28px 52px 0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
      <div style="width:50px;height:5px;background:${onPrimary}55;border-radius:3px;margin-bottom:14px;flex-shrink:0;"></div>
      <h1 style="font-size:${sqHFz}px;font-weight:900;color:${onPrimary};line-height:1.0;margin:0 0 12px;letter-spacing:-0.5px;flex-shrink:0;font-family:${fp.H};text-transform:uppercase;">${headline}</h1>
      <p style="font-size:18px;color:${onPrimary}CC;line-height:1.55;margin:0 0 14px;flex-shrink:0;font-family:${fp.B};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${featureBulletsOnPrimaryHtml}</div>
    </div>
    <div style="height:84px;flex-shrink:0;border-top:1px solid ${onPrimary}25;display:flex;align-items:center;padding:0 52px;gap:24px;">
      <span style="color:${onPrimary};font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:1px;font-family:${fp.H};">${cta} &#8594;</span>
      ${websiteUrl ? `<span style="margin-left:auto;color:${onPrimary}BB;font-size:15px;font-weight:600;font-family:${fp.B};">${websiteUrl}</span>` : ""}
    </div>
  </div>
</div>`;
  }

  // ── SQUARE variant 3: magazine editorial — accent bar left, photo strip right ──
  if (sqVariant === 3) {
    const sqHFz = hl > 70 ? 58 : hl > 50 ? 70 : hl > 35 ? 84 : 100;
    return `${fp.fi}<div style="width:1080px;height:1080px;font-family:${fp.B};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;background:#ffffff;">
  <div style="position:relative;flex:1;overflow:hidden;">
    <div style="position:absolute;top:0;left:0;bottom:0;width:8px;background:${primary};z-index:2;"></div>
    <div style="position:absolute;top:0;right:0;width:420px;bottom:0;overflow:hidden;">
      <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;${smoothStyle}" />
      <div style="position:absolute;inset:0;background:linear-gradient(to right, #ffffff 0%, transparent 30%);"></div>
    </div>
    <div style="position:absolute;top:0;left:8px;width:628px;bottom:0;padding:44px 40px 28px 44px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
      ${showBrandName ? `<div style="margin-bottom:20px;flex-shrink:0;">${logoEl}</div>` : ""}
      <h1 style="font-size:${sqHFz}px;font-weight:900;color:${primary};line-height:1.0;margin:0 0 14px;letter-spacing:-0.5px;flex-shrink:0;font-family:${fp.H};text-transform:uppercase;">${headline}</h1>
      <p style="font-size:19px;color:#3a3a3a;line-height:1.65;margin:0 0 16px;flex-shrink:0;font-family:${fp.B};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${featureBulletsHtml}</div>
      <div style="flex-shrink:0;margin-top:12px;">${ctaButtonHtml}</div>
    </div>
  </div>
  ${footerBar(44, 108, 15)}
</div>`;
  }

  // ── SQUARE variant 0: split panel — white left, diagonal photo right ──────────
  const textW = 460;
  const footerH = 108;
  const mainH = 1080 - footerH;
  const hFz = hl > 70 ? 52 : hl > 50 ? 60 : hl > 35 ? 72 : 88;

  return `${ANN_FONT_IMPORT}<div style="width:1080px;height:1080px;font-family:${B_FONT};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="position:relative;flex:1;overflow:hidden;background:#ffffff;">

    <!-- RIGHT PHOTO: angled left edge for diagonal bleed effect -->
    <div style="position:absolute;top:0;right:0;width:680px;height:${mainH}px;overflow:hidden;clip-path:polygon(120px 0%,100% 0%,100% 100%,0% 100%);">
      <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;${smoothStyle}" />
    </div>

    <!-- LEFT TEXT PANEL -->
    <div style="position:absolute;top:0;left:0;width:${textW}px;height:${mainH}px;padding:44px 40px 32px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
      ${showBrandName ? `<div style="margin-bottom:20px;flex-shrink:0;">${logoEl}</div>` : ""}
      <div style="width:52px;height:4px;background:${primary};border-radius:2px;margin-bottom:12px;flex-shrink:0;"></div>
      <h1 style="font-size:${hFz}px;font-weight:900;color:${primary};line-height:1.0;margin:0 0 12px;letter-spacing:-0.5px;flex-shrink:0;font-family:${H_FONT};text-transform:uppercase;">${headline}</h1>
      <p style="font-size:19px;color:#3a3a3a;line-height:1.65;margin:0 0 16px;flex-shrink:0;font-family:${B_FONT};">${subtext}</p>
      <div style="flex:1;overflow:hidden;">${featureBulletsHtml}</div>
      <div style="flex-shrink:0;margin-top:10px;">
        ${calloutStripHtml}
        ${ctaButtonHtml}
      </div>
    </div>

  </div>

  <!-- FOOTER BAR: trust badges + website -->
  ${footerBar(44, footerH, 15)}
</div>`;
}

// Helper: is a hex colour "light" (so we should put dark text on it)?
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0,2), 16);
  const g = parseInt(c.slice(2,4), 16);
  const b = parseInt(c.slice(4,6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  "imageScene": "string: start with 'photograph of' then describe a realistic scene — the product in use by an African person, setting, lighting. Example: 'photograph of Nigerian woman holding skincare product, bright vanity mirror, Lagos apartment'"
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
  const primary   = colors[0] ?? "#0D6B8C";
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  "imageScene": "string: start with 'photograph of' then describe a vertical lifestyle scene — African person, action, setting, lighting. Example: 'photograph of confident Nigerian woman in Lagos rooftop, golden hour light, looking at camera'"
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
  const primary   = colors[0] ?? "#0D6B8C";
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  const [primary, secondary] = [colors[0] ?? "#0D6B8C", colors[1] ?? "#1C1917"];
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  const primary   = colors[0] ?? "#0D6B8C";
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
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#0D6B8C", "#1C1917", "#FFFFFF"];
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
  "imageScene": "string: start with 'photograph of' then describe the ad scene — African person using the product/service, setting, lighting, emotion. Example: 'photograph of smiling Nigerian family in clean modern home, teal caregiver helping with meal, warm afternoon light'"
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
  const [primary, secondary] = [colors[0] ?? "#0D6B8C", colors[1] ?? "#1C1917"];
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
