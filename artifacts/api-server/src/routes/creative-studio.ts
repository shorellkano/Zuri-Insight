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

  // ── Assemble photography-first prompt ──
  // Format: [scene description], [subject context], [city], [lighting], [camera], [quality tags]
  const parts = [
    scene,
    subjectCtx,
    city,
    lighting,
    `${primaryColorName} accent colors in scene`,
    camera,
    "photorealistic, ultra detailed, 8k uhd, sharp focus, natural skin tones, professional stock photography, magazine editorial quality",
    "no text, no watermark, no logos",
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
      const fluxW = w <= 768 ? 768 : w <= 1024 ? 1024 : 1440;
      const fluxH = h <= 768 ? 768 : h <= 1024 ? 1024 : h <= 1440 ? 1440 : 1024;
      const dataUrl = await generateImage({ prompt: fluxPrompt, width: fluxW, height: fluxH, steps: 4 });
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
  let features: { emoji: string; label: string }[] = [];
  let callout = "";
  let imageScene = `${brand.name} ${brand.industry ?? "business"} announcement launch event, ${brand.city ?? brand.country ?? "African city"} setting, outdoor or modern venue`;
  try {
    if (hasAI()) {
      const result = await aiJSON(`You are a brand copywriter for African businesses.
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. Location: ${brand.city ?? brand.country ?? "Nigeria"}.
Announcement details: ${eventDetails || "General announcement — make something exciting"}

Extract and generate announcement copy. Return JSON:
{
  "headline": "string (1-2 lines max, emotional hook, sentence case — NOT all caps)",
  "subtext": "string (2-3 sentences, key details from the announcement, keep specific facts/numbers)",
  "cta": "string (max 4 words, action-driven)",
  "features": [
    { "emoji": "single emoji", "label": "2-4 word service/benefit label" }
  ],
  "callout": "string (1 punchy sentence, 10-18 words — the single most compelling reason to act)",
  "imageScene": "string: start with 'photograph of' then describe a specific realistic scene — African person, action, indoor/outdoor setting, lighting. Example: 'photograph of smiling Nigerian woman in teal uniform caring for toddler, bright Lagos home, warm natural light'"
}
Rules: features must be 3-5 items extracted from the announcement. Never use em dashes.`, "{}");
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
  features?: { emoji: string; label: string }[];
  callout?: string;
  brandName: string; colors: string[];
  format: string; showBrandName: boolean; logoUrl?: string | null; photoUrl: string;
  logoPosition?: string; contactInfo?: ContactInfo; smoothFace?: boolean; designStyle?: string;
}) {
  const primary   = colors[0] ?? "#0097A7";
  const secondary = colors[1] ?? "#1C1917";
  const isStory   = format === "story";
  const isPortrait = format === "portrait";
  const h = isStory ? 1920 : isPortrait ? 1350 : 1080;
  const smoothStyle = smoothFace ? "filter:blur(0.5px) saturate(1.1) contrast(1.05);" : "";
  const hl = headline.length;

  // determine readable text colour on primary background
  const primaryIsLight = isLightColor(primary);
  const onPrimary = primaryIsLight ? "#1a1a1a" : "#ffffff";

  // logo element — works on white bg
  const logoEl = showBrandName
    ? (logoUrl
        ? `<img src="${logoUrl}" crossorigin="anonymous" alt="${brandName}" style="height:40px;max-width:180px;object-fit:contain;" />`
        : `<div style="display:flex;align-items:center;gap:10px;">
             <div style="width:36px;height:36px;border-radius:50%;background:${primary};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
               <span style="color:${onPrimary};font-size:15px;font-weight:900;font-family:${FONT_STACK};">${brandName.charAt(0).toUpperCase()}</span>
             </div>
             <span style="color:${secondary};font-size:15px;font-weight:700;font-family:${FONT_STACK};">${brandName}</span>
           </div>`)
    : "";

  // feature icons grid
  const featuresHtml = features.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(features.length, 4)},1fr);gap:10px;margin:16px 0 14px;">
        ${features.map(f => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
          <div style="width:38px;height:38px;border-radius:50%;border:1.5px solid ${primary};display:flex;align-items:center;justify-content:center;font-size:16px;">${f.emoji}</div>
          <span style="font-size:10.5px;font-weight:600;color:#444;text-align:center;line-height:1.3;">${f.label}</span>
        </div>`).join("")}
      </div>`
    : "";

  // callout box
  const calloutHtml = callout
    ? `<div style="background:${primary};border-radius:12px;padding:13px 15px;display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;">
        <span style="font-size:18px;flex-shrink:0;margin-top:1px;">🏠</span>
        <p style="margin:0;font-size:13px;font-weight:500;color:${onPrimary};line-height:1.55;">${callout}</p>
      </div>`
    : "";

  // website footer
  const websiteUrl = (contactInfo as Record<string,string>).website ?? "";
  const footerHtml = websiteUrl
    ? `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#777;margin-top:10px;"><span>🌐</span><span>${websiteUrl}</span></div>`
    : "";

  // ── STORY: photo top strip, editorial text panel below ───────────────────────
  if (isStory) {
    const photoH = 860;
    const hFz = hl > 60 ? 46 : hl > 40 ? 56 : hl > 25 ? 66 : 78;
    return `${FONT_IMPORT}<div style="width:1080px;height:1920px;font-family:${FONT_STACK};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="width:1080px;height:${photoH}px;overflow:hidden;flex-shrink:0;position:relative;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;${smoothStyle}" />
    ${showBrandName ? `<div style="position:absolute;top:52px;left:52px;background:rgba(255,255,255,0.92);padding:10px 18px;border-radius:100px;">${logoEl}</div>` : ""}
  </div>
  <div style="background:#ffffff;flex:1;padding:44px 52px 36px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
    <div>
      <h1 style="font-size:${hFz}px;font-weight:800;color:${primary};line-height:1.12;margin:0 0 14px;letter-spacing:-0.3px;">${headline}</h1>
      <p style="font-size:26px;color:#333;line-height:1.6;margin:0 0 4px;">${subtext}</p>
      ${featuresHtml}
      ${calloutHtml}
    </div>
    <div>
      ${cta ? `<div style="display:inline-flex;background:${primary};color:${onPrimary};padding:16px 40px;border-radius:100px;font-weight:700;font-size:22px;margin-bottom:14px;">${cta}</div>` : ""}
      ${footerHtml}
    </div>
  </div>
</div>`;
  }

  // ── PORTRAIT: editorial, text top, photo card below ─────────────────────────
  if (isPortrait) {
    const hFz = hl > 60 ? 46 : hl > 40 ? 56 : hl > 25 ? 68 : 82;
    return `${FONT_IMPORT}<div style="width:1080px;height:1350px;font-family:${FONT_STACK};overflow:hidden;background:#ffffff;box-sizing:border-box;display:flex;flex-direction:column;">
  <div style="padding:52px 60px 28px;flex-shrink:0;">
    ${showBrandName ? `<div style="margin-bottom:24px;">${logoEl}</div>` : ""}
    <h1 style="font-size:${hFz}px;font-weight:800;color:${primary};line-height:1.12;margin:0 0 14px;letter-spacing:-0.3px;">${headline}</h1>
    <p style="font-size:25px;color:#333;line-height:1.6;margin:0 0 12px;">${subtext}</p>
    ${featuresHtml}
    ${calloutHtml}
    ${cta ? `<div style="display:inline-flex;background:${primary};color:${onPrimary};padding:14px 36px;border-radius:100px;font-weight:700;font-size:20px;margin-top:8px;">${cta}</div>` : ""}
  </div>
  <div style="flex:1;overflow:hidden;margin:0 40px;border-radius:24px;box-shadow:0 16px 48px rgba(0,0,0,0.12);">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;${smoothStyle}" />
  </div>
  ${footerHtml ? `<div style="padding:16px 60px 24px;">${footerHtml}</div>` : ""}
</div>`;
  }

  // ── SQUARE: editorial split — text left panel, photo right panel ─────────────
  const textW = 496;
  const photoW = 1080 - textW;
  const hFz = hl > 60 ? 36 : hl > 40 ? 44 : hl > 25 ? 52 : 62;

  return `${FONT_IMPORT}<div style="width:1080px;height:1080px;font-family:${FONT_STACK};overflow:hidden;box-sizing:border-box;display:flex;flex-direction:row;">
  <div style="width:${textW}px;height:1080px;background:#ffffff;padding:40px 36px 32px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
    ${showBrandName ? `<div style="margin-bottom:20px;flex-shrink:0;">${logoEl}</div>` : ""}
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;">
      <h1 style="font-size:${hFz}px;font-weight:800;color:${primary};line-height:1.15;margin:0 0 12px;letter-spacing:-0.3px;flex-shrink:0;">${headline}</h1>
      <p style="font-size:14.5px;color:#333;line-height:1.65;margin:0 0 4px;flex-shrink:0;">${subtext}</p>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;overflow:hidden;min-height:0;">
        ${featuresHtml}
        ${calloutHtml}
      </div>
    </div>
    <div style="flex-shrink:0;">
      ${cta ? `<div style="display:inline-flex;background:${primary};color:${onPrimary};padding:11px 26px;border-radius:100px;font-weight:700;font-size:14px;margin-bottom:10px;">${cta}</div>` : ""}
      ${footerHtml}
    </div>
  </div>
  <div style="width:${photoW}px;height:1080px;overflow:hidden;flex-shrink:0;">
    <img src="${photoUrl}" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;${smoothStyle}" />
  </div>
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
