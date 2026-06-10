import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, brandsTable, contentPlansTable, contentPlanItemsTable, calendarEventsTable, brandCalendarEventsTable, brandDnaTable } from "@workspace/db";
import { aiJSONRace, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

function stripJsonFences(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

// ─── Generate Plan Suggestion ──────────────────────────────────────────────────

router.post("/brands/:brandId/bulk-plan/suggest", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { startDate, endDate, platforms, postsPerPlatformPerWeek = 3, contentMix, planName } = req.body;

  if (!startDate || !endDate || !platforms?.length) {
    res.status(400).json({ error: "startDate, endDate, platforms required" });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));

  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;

  const globalEvents = await db.select().from(calendarEventsTable).where(
    and(gte(calendarEventsTable.month, startMonth), lte(calendarEventsTable.month, endMonth))
  );

  const brandEvents = await db.select().from(brandCalendarEventsTable).where(
    and(
      eq(brandCalendarEventsTable.brandId, brandId),
      gte(brandCalendarEventsTable.eventDate, startDate),
      lte(brandCalendarEventsTable.eventDate, endDate)
    )
  );

  const mix = contentMix ?? { promotional: 30, educational: 30, engagement: 25, brand_story: 15 };
  const themes = dna?.keyMessages ?? ["Brand story", "Product highlight", "Customer value", "Industry insight", "Engagement question"];

  try {
    if (!hasAI()) throw new Error("no-ai");

    // Estimate total slots to size the token budget correctly
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
    const estimatedSlots = platforms.length * postsPerPlatformPerWeek * totalWeeks;
    // ~110 tokens per slot (compact JSON) + 400 overhead; cap at 4000
    const tokenBudget = Math.min(4000, Math.max(1200, estimatedSlots * 110 + 400));

    const eventSummary = globalEvents
      .slice(0, 6)
      .map(e => `${e.name} (month ${e.month}, day ${e.day ?? "?"})`)
      .join("; ");

    const brandEventSummary = brandEvents
      .slice(0, 4)
      .map(e => `${e.name} on ${e.eventDate}`)
      .join("; ");

    const system = `You are a social media strategist for African businesses.
Return ONLY valid compact JSON. No markdown fences, no explanation.`;

    const user = `Build a content calendar for ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).

Period: ${startDate} to ${endDate}
Platforms: ${platforms.join(", ")}
Frequency: ${postsPerPlatformPerWeek} posts per platform per week
Mix: ${mix.promotional}% promo, ${mix.educational}% edu, ${mix.engagement}% engage, ${mix.brand_story}% story
Themes: ${themes.slice(0, 4).join(", ")}
${eventSummary ? `Calendar events: ${eventSummary}` : ""}
${brandEventSummary ? `Brand events: ${brandEventSummary}` : ""}

Rules: Spread posts evenly. Vary post types (feed_post/carousel/reel/story). Peak times WAT: 07:00, 12:00, 19:00.

Return JSON with a "slots" array. Each slot:
{"date":"YYYY-MM-DD","platform":"instagram","time":"12:00","type":"reel","theme":"Product highlight","angle":"One sentence describing what this post says","event":null}

Return exactly this JSON structure:
{"slots":[...]}`;

    const suggestion = await aiJSONRace<{ slots: any[] }>(system, user, tokenBudget);

    const rawSlots: any[] = Array.isArray(suggestion?.slots) ? suggestion.slots : [];

    // Normalise field names (model may vary: suggested_time vs time, post_type vs type, etc.)
    const slots = rawSlots
      .filter(s => s && s.date && s.platform)
      .map((s, i) => ({
        date: s.date,
        platform: String(s.platform).toLowerCase(),
        suggested_time: s.time ?? s.suggested_time ?? "12:00",
        post_type: s.type ?? s.post_type ?? "feed_post",
        content_theme: s.theme ?? s.content_theme ?? themes[i % themes.length] ?? "Brand story",
        content_angle: s.angle ?? s.content_angle ?? "",
        calendar_event: s.event ?? s.calendar_event ?? null,
        design_style: s.design_style ?? "Standard post",
      }));

    const userId = (req as any).user?.id ?? brandId;
    const [plan] = await db.insert(contentPlansTable).values({
      brandId,
      userId,
      planName: planName ?? `${brand.name} plan ${startDate}`,
      periodType: "custom",
      startDate,
      endDate,
      platforms,
      status: "draft",
    }).returning();

    // Guard: don't insert if no slots (DB would throw on empty values)
    const items = slots.length > 0
      ? await db.insert(contentPlanItemsTable).values(
          slots.map(slot => ({
            planId: plan.id,
            brandId,
            platform: slot.platform,
            postType: slot.post_type,
            suggestedDate: slot.date,
            suggestedTime: slot.suggested_time,
            contentTheme: slot.content_theme,
            calendarEvent: slot.calendar_event,
            contentAngle: slot.content_angle,
            designBrief: slot.design_style,
            status: "draft",
          }))
        ).returning()
      : [];

    res.status(201).json({ plan, items, suggestion: { ...suggestion, slots } });
  } catch (err: any) {
    if (err.message === "no-ai") {
      res.status(503).json({ error: "AI unavailable" });
    } else {
      console.error("Bulk plan error:", err);
      res.status(500).json({ error: String(err.message ?? "Generation failed") });
    }
  }
});

// ─── Get Plan + Items ──────────────────────────────────────────────────────────

router.get("/brands/:brandId/bulk-plans", async (req, res): Promise<void> => {
  const plans = await db.select().from(contentPlansTable).where(eq(contentPlansTable.brandId, req.params.brandId));
  res.json(plans);
});

router.get("/bulk-plans/:planId", async (req, res): Promise<void> => {
  const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, req.params.planId));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(contentPlanItemsTable).where(eq(contentPlanItemsTable.planId, req.params.planId));
  res.json({ plan, items });
});

router.patch("/bulk-plan-items/:itemId", async (req, res): Promise<void> => {
  const { contentTheme, suggestedDate, suggestedTime, status, captionDraft } = req.body;
  const [updated] = await db.update(contentPlanItemsTable)
    .set({ contentTheme, suggestedDate, suggestedTime, status, captionDraft })
    .where(eq(contentPlanItemsTable.id, req.params.itemId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/bulk-plan-items/:itemId", async (req, res): Promise<void> => {
  await db.delete(contentPlanItemsTable).where(eq(contentPlanItemsTable.id, req.params.itemId));
  res.status(204).end();
});

// ─── Generate Caption for a Single Plan Item ───────────────────────────────────

router.post("/bulk-plan-items/:itemId/generate", async (req, res): Promise<void> => {
  const { brandId } = req.body;
  if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }

  const [item] = await db.select().from(contentPlanItemsTable).where(eq(contentPlanItemsTable.id, req.params.itemId));
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));

  const platformTips: Record<string, string> = {
    instagram: "Instagram caption: engaging opener, 3-5 sentences, 3-5 relevant hashtags at end.",
    facebook: "Facebook post: conversational, 2-4 sentences, no hashtags needed.",
    tiktok: "TikTok caption: punchy hook, 1-2 sentences, 3 trending hashtags.",
    linkedin: "LinkedIn post: professional insight-led, 3-5 sentences, 1-2 hashtags.",
    youtube: "YouTube description: 2-3 sentences summarising value, include a CTA.",
  };

  const voice = dna ? `Brand voice: ${dna.toneOfVoice ?? "professional and engaging"}. Core values: ${(dna.coreValues ?? []).slice(0, 3).join(", ")}.` : "";
  const tip = platformTips[item.platform ?? ""] ?? "Write an engaging social media post.";

  const isCarousel = (item.postType ?? "").toLowerCase().includes("carousel");
  const carouselRule = isCarousel
    ? `\nCARROUSEL CAPTION RULE: This is a Carousel post but only the caption is being produced — no actual slides exist. NEVER write "swipe", "swipe through", "slide 1 of X", "check out slide", or reference numbered tips/slides. Write a punchy standalone paragraph that hooks the reader on the topic without promising slides they can't see.`
    : "";
  const numberedListRule = `\nNUMBERED LIST RULE: Never write "X steps", "X tips", "X ways", "X things" (e.g. "five practical steps", "3 tips") UNLESS you fully list every single item in that count within the same caption. If you cannot fit all items, use "some steps", "a few tips" or similar — never promise a number you won't deliver.`;

  const system = `You are an expert African marketing copywriter writing for ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).
${voice}
Write authentic, culturally relevant content for African audiences.
NEVER use em dashes (—). Use hyphens (-), commas, or full stops instead.${carouselRule}${numberedListRule}
Return ONLY the caption text - no labels, no explanation, no quotes wrapping it.`;

  const user = `Write a ${item.platform} caption for this planned post:

Platform: ${item.platform}
Post type: ${item.postType?.replace("_", " ")}
Content theme: ${item.contentTheme}
Content angle: ${item.contentAngle}
Design context: ${item.designBrief}
${item.calendarEvent ? `Tied to: ${item.calendarEvent}` : ""}
Scheduled: ${item.suggestedDate} at ${item.suggestedTime}

${tip}`;

  try {
    if (!hasAI()) throw new Error("no-ai");
    const { aiComplete } = await import("../lib/ai.js");
    const caption = await aiComplete(system, user, 400);

    const [updated] = await db.update(contentPlanItemsTable)
      .set({ captionDraft: caption.trim(), status: "generated" })
      .where(eq(contentPlanItemsTable.id, req.params.itemId))
      .returning();

    res.json(updated);
  } catch (err: any) {
    if (err.message === "no-ai") {
      res.status(503).json({ error: "AI unavailable" });
    } else {
      console.error("Item generation error:", err);
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
