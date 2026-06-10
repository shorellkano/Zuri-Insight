import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, brandsTable, contentPlansTable, contentPlanItemsTable, calendarEventsTable, brandCalendarEventsTable, brandDnaTable } from "@workspace/db";
import { aiJSONRace, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

// ─── Deterministic fallback plan ──────────────────────────────────────────────
// When AI is unavailable or fails, always return a usable skeleton plan.
// Users can edit themes/angles — nothing is left blank.

const POST_TYPES = ["feed_post", "carousel", "reel", "story"];
const POSTING_TIMES = ["07:00", "12:00", "19:00"];
const DEFAULT_THEMES = ["Brand story", "Product highlight", "Customer value", "Industry insight", "Engagement question", "Behind the scenes", "Customer testimonial"];

function buildFallbackSlots(
  platforms: string[],
  startDate: string,
  endDate: string,
  postsPerPlatformPerWeek: number,
  themes: string[],
): Array<{
  date: string; platform: string; suggested_time: string;
  post_type: string; content_theme: string; content_angle: string;
  calendar_event: string | null; design_style: string;
}> {
  const slots: ReturnType<typeof buildFallbackSlots> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const usedThemes = themes.length > 0 ? themes : DEFAULT_THEMES;

  let slotIndex = 0;
  for (const platform of platforms) {
    const totalPosts = postsPerPlatformPerWeek * totalWeeks;
    // Space posts evenly across the available days (skip weekends for LinkedIn)
    const skipWeekends = platform === "linkedin";
    const availableDays: string[] = [];
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + d);
      const dow = date.getDay(); // 0=Sun, 6=Sat
      if (skipWeekends && (dow === 0 || dow === 6)) continue;
      availableDays.push(date.toISOString().split("T")[0]);
    }

    const step = Math.max(1, Math.floor(availableDays.length / totalPosts));
    for (let i = 0; i < totalPosts && i * step < availableDays.length; i++) {
      const date = availableDays[i * step];
      slots.push({
        date,
        platform,
        suggested_time: POSTING_TIMES[slotIndex % POSTING_TIMES.length],
        post_type: POST_TYPES[slotIndex % POST_TYPES.length],
        content_theme: usedThemes[slotIndex % usedThemes.length],
        content_angle: `${usedThemes[slotIndex % usedThemes.length]} - add your specific message here`,
        calendar_event: null,
        design_style: "Standard post",
      });
      slotIndex++;
    }
  }

  return slots.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Normalise AI slot field names ────────────────────────────────────────────
// Different models use different key names. Accept all variants.
function normaliseSlot(s: any, index: number, themes: string[]): ReturnType<typeof buildFallbackSlots>[number] {
  return {
    date: String(s.date ?? ""),
    platform: String(s.platform ?? "instagram").toLowerCase(),
    suggested_time: s.time ?? s.suggested_time ?? POSTING_TIMES[index % POSTING_TIMES.length],
    post_type: s.type ?? s.post_type ?? POST_TYPES[index % POST_TYPES.length],
    content_theme: s.theme ?? s.content_theme ?? themes[index % themes.length] ?? "Brand story",
    content_angle: s.angle ?? s.content_angle ?? "",
    calendar_event: s.event ?? s.calendar_event ?? null,
    design_style: s.design_style ?? "Standard post",
  };
}

// ─── Save plan + items to DB ──────────────────────────────────────────────────
async function savePlan(
  brandId: string,
  userId: string,
  planName: string,
  startDate: string,
  endDate: string,
  platforms: string[],
  slots: ReturnType<typeof buildFallbackSlots>,
) {
  const [plan] = await db.insert(contentPlansTable).values({
    brandId, userId, planName, periodType: "custom",
    startDate, endDate, platforms, status: "draft",
  }).returning();

  const items = slots.length > 0
    ? await db.insert(contentPlanItemsTable).values(
        slots.map(slot => ({
          planId: plan.id, brandId,
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

  return { plan, items };
}

// ─── Generate Plan Suggestion ──────────────────────────────────────────────────
router.post("/brands/:brandId/bulk-plan/suggest", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { startDate, endDate, platforms, postsPerPlatformPerWeek = 3, contentMix, planName } = req.body;

  if (!startDate || !endDate || !platforms?.length) {
    res.status(400).json({ error: "startDate, endDate, platforms required" });
    return;
  }

  // ── Everything in one try/catch: DB reads, AI, DB writes ─────────────────
  try {
    const userId = (req as any).user?.id ?? brandId;

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

    const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)).catch(() => [null]);

    const startMonth = new Date(startDate).getMonth() + 1;
    const endMonth   = new Date(endDate).getMonth() + 1;

    // Non-critical lookups: gracefully degrade if tables don't exist
    const globalEvents = await db.select().from(calendarEventsTable).where(
      and(gte(calendarEventsTable.month, startMonth), lte(calendarEventsTable.month, endMonth))
    ).catch(() => []);

    const brandEvents = await db.select().from(brandCalendarEventsTable).where(
      and(
        eq(brandCalendarEventsTable.brandId, brandId),
        gte(brandCalendarEventsTable.eventDate, startDate),
        lte(brandCalendarEventsTable.eventDate, endDate)
      )
    ).catch(() => []);

    const mix = contentMix ?? { promotional: 30, educational: 30, engagement: 25, brand_story: 15 };
    const themes: string[] = dna?.keyMessages ?? DEFAULT_THEMES;

    // ── Try AI; fall back to deterministic template if anything goes wrong ──
    let slots: ReturnType<typeof buildFallbackSlots>;
    let isFallback = false;
    let fallbackNote: string | undefined;

    if (!hasAI()) {
      isFallback = true;
      fallbackNote = "AI is not configured. Here is a starter schedule - edit the angles to match your brand.";
      slots = buildFallbackSlots(platforms, startDate, endDate, postsPerPlatformPerWeek, themes);
    } else {
      try {
        const startDt = new Date(startDate);
        const endDt   = new Date(endDate);
        const totalWeeks = Math.max(1, Math.ceil((endDt.getTime() - startDt.getTime()) / (7 * 86400000)));
        const estimatedSlots = platforms.length * postsPerPlatformPerWeek * totalWeeks;
        const tokenBudget = Math.min(4000, Math.max(1200, estimatedSlots * 110 + 400));

        const eventSummary = globalEvents.slice(0, 5)
          .map((e: any) => `${e.name} (month ${e.month}, day ${e.day ?? "?"})`)
          .join("; ");
        const brandEventSummary = brandEvents.slice(0, 3)
          .map((e: any) => `${e.name} on ${e.eventDate}`)
          .join("; ");

        const system = `You are a social media strategist for African businesses.
Return ONLY valid compact JSON with no markdown, no explanation.`;

        const user = `Content calendar for ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).

Period: ${startDate} to ${endDate}
Platforms: ${platforms.join(", ")}
Frequency: ${postsPerPlatformPerWeek} posts per platform per week
Mix: ${mix.promotional}% promo, ${mix.educational}% educational, ${mix.engagement}% engagement
Themes: ${themes.slice(0, 4).join(", ")}
${eventSummary ? `Calendar events: ${eventSummary}` : ""}
${brandEventSummary ? `Brand events: ${brandEventSummary}` : ""}

Spread posts evenly. Vary post types: feed_post, carousel, reel, story. Best times WAT: 07:00, 12:00, 19:00.

Return exactly: {"slots":[{"date":"YYYY-MM-DD","platform":"instagram","time":"12:00","type":"reel","theme":"Product highlight","angle":"One line on what this post says","event":null},...]}`;

        const result = await aiJSONRace<{ slots: any[] }>(system, user, tokenBudget);
        const rawSlots: any[] = Array.isArray(result?.slots) ? result.slots : [];
        slots = rawSlots
          .filter(s => s && s.date && s.platform)
          .map((s, i) => normaliseSlot(s, i, themes));

        // If AI returned nothing useful, fall back silently
        if (slots.length === 0) {
          isFallback = true;
          fallbackNote = "AI returned an empty plan. Here is a starter schedule you can edit.";
          slots = buildFallbackSlots(platforms, startDate, endDate, postsPerPlatformPerWeek, themes);
        }
      } catch (aiErr: any) {
        console.warn("[bulk-plan] AI failed, using fallback:", aiErr?.message ?? aiErr);
        isFallback = true;
        const isRateLimit = aiErr?.isRateLimit || String(aiErr?.message ?? "").includes("429");
        fallbackNote = isRateLimit
          ? "AI is busy right now - here is a starter schedule. Edit the angles to match your brand."
          : "AI is unavailable - here is a starter schedule. Edit the angles to match your brand.";
        slots = buildFallbackSlots(platforms, startDate, endDate, postsPerPlatformPerWeek, themes);
      }
    }

    const { plan, items } = await savePlan(
      brandId, userId,
      planName ?? `${brand.name} plan ${startDate}`,
      startDate, endDate, platforms, slots,
    );

    res.status(201).json({
      plan, items,
      ...(isFallback ? { isTemplateFallback: true, note: fallbackNote } : {}),
    });
  } catch (err: any) {
    console.error("[bulk-plan] Unhandled error:", err);
    res.status(500).json({ error: String(err?.message ?? "Something went wrong. Please try again.") });
  }
});

// ─── Get Plan + Items ──────────────────────────────────────────────────────────
router.get("/brands/:brandId/bulk-plans", async (req, res): Promise<void> => {
  try {
    const plans = await db.select().from(contentPlansTable).where(eq(contentPlansTable.brandId, req.params.brandId));
    res.json(plans);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? "Failed to load plans") });
  }
});

router.get("/bulk-plans/:planId", async (req, res): Promise<void> => {
  try {
    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, req.params.planId));
    if (!plan) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(contentPlanItemsTable).where(eq(contentPlanItemsTable.planId, req.params.planId));
    res.json({ plan, items });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? "Failed to load plan") });
  }
});

router.patch("/bulk-plan-items/:itemId", async (req, res): Promise<void> => {
  try {
    const { contentTheme, suggestedDate, suggestedTime, status, captionDraft } = req.body;
    const [updated] = await db.update(contentPlanItemsTable)
      .set({ contentTheme, suggestedDate, suggestedTime, status, captionDraft })
      .where(eq(contentPlanItemsTable.id, req.params.itemId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? "Failed to update item") });
  }
});

router.delete("/bulk-plan-items/:itemId", async (req, res): Promise<void> => {
  try {
    await db.delete(contentPlanItemsTable).where(eq(contentPlanItemsTable.id, req.params.itemId));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? "Failed to delete item") });
  }
});

// ─── Generate Caption for a Single Plan Item ───────────────────────────────────
router.post("/bulk-plan-items/:itemId/generate", async (req, res): Promise<void> => {
  try {
    const { brandId } = req.body;
    if (!brandId) { res.status(400).json({ error: "brandId required" }); return; }

    const [item] = await db.select().from(contentPlanItemsTable).where(eq(contentPlanItemsTable.id, req.params.itemId));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }

    const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId)).catch(() => [null]);

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
      ? `\nCARROUSEL CAPTION RULE: Never write "swipe", "slide 1 of X", or reference numbered slides. Write a punchy standalone paragraph.`
      : "";
    const numberedListRule = `\nNEVER write "X steps", "X tips", "X ways" unless you fully list all items in the caption.`;

    const system = `You are an expert African marketing copywriter for ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).
${voice}
NEVER use em dashes (—). Use hyphens (-), commas, or full stops instead.${carouselRule}${numberedListRule}
Return ONLY the caption text - no labels, no explanation, no surrounding quotes.`;

    const user = `Write a ${item.platform} caption for this post:
Platform: ${item.platform}
Post type: ${item.postType?.replace("_", " ")}
Content theme: ${item.contentTheme}
Content angle: ${item.contentAngle}
Design context: ${item.designBrief}
${item.calendarEvent ? `Tied to: ${item.calendarEvent}` : ""}
Scheduled: ${item.suggestedDate} at ${item.suggestedTime}

${tip}`;

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
      console.error("[bulk-plan-item] generation error:", err);
      res.status(500).json({ error: String(err?.message ?? "Generation failed") });
    }
  }
});

export default router;
