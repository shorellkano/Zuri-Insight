import { Router, type IRouter } from "express";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { db, brandsTable, contentPlansTable, contentPlanItemsTable, calendarEventsTable, brandCalendarEventsTable, brandDnaTable } from "@workspace/db";
import { aiJSON, hasAI } from "../lib/ai.js";

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

    const system = `You are a senior social media strategist for African businesses.
Build a structured content calendar plan.
Return ONLY valid JSON. No markdown, no explanation.`;

    const user = `Build a content calendar for ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).

PERIOD: ${startDate} to ${endDate}
PLATFORMS: ${platforms.join(", ")}
FREQUENCY: ${postsPerPlatformPerWeek} posts per platform per week
CONTENT MIX: ${mix.promotional}% promotional, ${mix.educational}% educational, ${mix.engagement}% engagement, ${mix.brand_story}% brand story
BRAND THEMES: ${themes.slice(0, 5).join(", ")}

GLOBAL CALENDAR EVENTS IN THIS PERIOD:
${JSON.stringify(globalEvents.slice(0, 10).map(e => ({ name: e.name, month: e.month, day: e.day, angle: e.contentAngle })), null, 2)}

BRAND-SPECIFIC EVENTS:
${JSON.stringify(brandEvents.map(e => ({ name: e.name, date: e.eventDate, type: e.eventType })), null, 2)}

RULES:
1. Calendar events and brand events get dedicated posts.
2. For major events, suggest a lead-up post 1-2 days before.
3. Distribute posts evenly across the week.
4. Vary post type (feed_post, carousel, reel, story) across the plan.
5. Vary content theme — no two consecutive posts on same theme.
6. Suggest optimal posting times (WAT timezone, peak hours: 7am, 12pm, 7pm).
7. Professional English content angles only.

Return JSON:
{
  "period": { "start": "${startDate}", "end": "${endDate}", "total_posts": 0 },
  "platforms": [],
  "calendar_events_included": [],
  "slots": [
    {
      "slot_number": 1,
      "date": "YYYY-MM-DD",
      "platform": "instagram",
      "suggested_time": "09:00",
      "post_type": "feed_post",
      "content_theme": "Product highlight",
      "calendar_event": null,
      "content_angle": "What this post should say",
      "design_style": "Quote card",
      "priority": "normal"
    }
  ]
}`;

    const suggestion = await aiJSON<{ period: any; platforms: string[]; calendar_events_included: any[]; slots: any[] }>(system, user, 700);

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

    const items = await db.insert(contentPlanItemsTable).values(
      suggestion.slots.map((slot: any) => ({
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
    ).returning();

    res.status(201).json({ plan, items, suggestion });
  } catch (err: any) {
    if (err.message === "no-ai") {
      res.status(503).json({ error: "AI unavailable" });
    } else {
      console.error("Bulk plan error:", err);
      res.status(500).json({ error: err.message });
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

export default router;
