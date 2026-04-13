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
  const { brandId, topic, slideCount = 5, platform = "instagram", showBrandName = true } = req.body;
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
NEVER use em dashes (--). Use hyphens (-) or rewrite sentences instead.
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

Rules: First slide is the hook - make it impossible to scroll past. Last slide has a clear CTA. Never use em dashes (--).`;

    const result = await aiJSON<{ title: string; slides: Array<{ slide_number: number; headline: string; body: string; cta?: string }> }>(system, user, 500);

    const logoUrl = prefs?.logoUrl ?? null;
    const slides = result.slides.map((slide, i) => ({
      ...slide,
      html: buildSlideHtml({ ...slide, brandName: brand.name, colors, style, slideNumber: i + 1, total: result.slides.length, showBrandName, logoUrl }),
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
  const isDark = style === "dark" || style === "premium";
  const bgColor = isDark ? "#0F0F0F" : bg;
  const textColor = isDark ? "#FFFFFF" : text;

  let brandTag = `<span></span>`;
  if (showBrandName) {
    if (logoUrl) {
      brandTag = `<img src="${logoUrl}" alt="${brandName}" style="height:36px;max-width:160px;object-fit:contain;filter:brightness(0) invert(1);" />`;
    } else {
      brandTag = `<span style="color:${primary};font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${brandName}</span>`;
    }
  }

  return `<div style="width:1080px;height:1080px;background:${bgColor};display:flex;flex-direction:column;justify-content:space-between;padding:80px;font-family:'Inter',sans-serif;box-sizing:border-box;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;left:0;width:12px;height:100%;background:${primary};"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-left:20px;">
    ${brandTag}
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

function buildQuoteCardHtml({ quoteText, attribution, brandName, colors, backgroundStyle, format, showBrandName = true, logoUrl }: {
  quoteText: string; attribution?: string; brandName: string; colors: string[];
  backgroundStyle: string; format: string; showBrandName?: boolean; logoUrl?: string | null;
}) {
  const [primary, bg, text] = [colors[0] ?? "#D97706", colors[1] ?? "#1C1917", colors[2] ?? "#FFFFFF"];
  const dims = format === "story" ? "width:1080px;height:1920px" : format === "portrait" ? "width:1080px;height:1350px" : "width:1080px;height:1080px";
  const gradientBg = backgroundStyle === "gradient"
    ? `background:linear-gradient(135deg, ${bg} 0%, ${primary}66 100%)`
    : `background:${bg}`;

  let brandBlock = "";
  if (showBrandName) {
    if (logoUrl) {
      brandBlock = `<img src="${logoUrl}" alt="${brandName}" style="height:40px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);margin:0 auto;" />`;
    } else {
      brandBlock = `<p style="color:${primary};font-size:20px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0;">${brandName}</p>`;
    }
  }

  return `<div style="${dims};${gradientBg};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:100px;font-family:'Inter',sans-serif;box-sizing:border-box;text-align:center;">
  <div style="font-size:120px;color:${primary};line-height:0.5;margin-bottom:40px;opacity:0.4;">"</div>
  <p style="color:${text};font-size:${quoteText.length > 100 ? '40px' : '52px'};font-weight:700;line-height:1.4;margin:0 0 48px 0;letter-spacing:-0.5px;">${quoteText}</p>
  ${attribution ? `<p style="color:${text}80;font-size:24px;font-weight:500;margin:0 0 16px 0;">- ${attribution}</p>` : ""}
  ${brandBlock ? `<div style="width:60px;height:3px;background:${primary};border-radius:2px;margin:16px 0;"></div>${brandBlock}` : ""}
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
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. ${brand.description ? `About: ${brand.description}` : ""}
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
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  return `<div style="${dims};background:${bg};display:flex;flex-direction:column;font-family:'Inter',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="position:absolute;top:0;left:0;right:0;height:8px;background:${primary};"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:100px;text-align:center;gap:32px;">
    <div style="padding:8px 24px;background:${primary}22;border:1px solid ${primary}55;border-radius:100px;">
      <span style="color:${primary};font-size:18px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">Announcement</span>
    </div>
    <h1 style="color:${text};font-size:${headline.length > 30 ? '60px' : '76px'};font-weight:900;line-height:1.1;margin:0;letter-spacing:-2px;">${headline}</h1>
    <p style="color:${text}BB;font-size:28px;line-height:1.5;margin:0;max-width:800px;">${subtext}</p>
    <div style="margin-top:16px;padding:20px 48px;background:${primary};border-radius:12px;display:inline-block;">
      <span style="color:#fff;font-size:24px;font-weight:700;">${cta}</span>
    </div>
  </div>
  ${bm ? `<div style="padding:40px 100px;display:flex;justify-content:center;">${bm}</div>` : ""}
  <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:${primary};"></div>
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
  const bm = brandMark({ showBrandName, logoUrl, brandName, primary, dark: true });
  return `<div style="${dims};background:${bg};display:flex;flex-direction:column;font-family:'Inter',sans-serif;box-sizing:border-box;overflow:hidden;position:relative;">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:60px 80px 0;">
    ${bm || `<span></span>`}
    ${price ? `<div style="padding:10px 28px;background:${primary};border-radius:100px;"><span style="color:#fff;font-size:22px;font-weight:800;">${price}</span></div>` : "<span></span>"}
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 80px;gap:24px;">
    <div style="width:60px;height:6px;background:${primary};border-radius:3px;"></div>
    <p style="color:${primary};font-size:20px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin:0;">${productName}</p>
    <h1 style="color:${text};font-size:${headline.length > 30 ? '56px' : '72px'};font-weight:900;line-height:1.1;margin:0;letter-spacing:-1px;">${headline}</h1>
    <p style="color:${text}AA;font-size:26px;line-height:1.5;margin:0;">${tagline}</p>
  </div>
  <div style="padding:0 80px 80px;">
    <div style="padding:22px 48px;background:${primary};border-radius:14px;display:inline-block;">
      <span style="color:#fff;font-size:24px;font-weight:700;">${cta}</span>
    </div>
  </div>
  <div style="position:absolute;right:0;top:0;bottom:0;width:8px;background:${primary};"></div>
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
Brand: ${brand.name}. Industry: ${brand.industry || "Business"}. ${brand.description ? `About: ${brand.description}` : ""}
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
