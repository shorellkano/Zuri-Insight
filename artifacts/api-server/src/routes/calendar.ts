import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, scheduledPostsTable, calendarEventsTable, brandCalendarEventsTable, brandsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Scheduled Posts ──────────────────────────────────────────────────────────

router.get("/brands/:brandId/scheduled-posts", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  let query = db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.brandId, brandId)).$dynamic();

  if (from) query = query.where(gte(scheduledPostsTable.scheduledFor, new Date(from)));
  if (to)   query = query.where(lte(scheduledPostsTable.scheduledFor, new Date(to)));

  const posts = await db.select().from(scheduledPostsTable)
    .where(eq(scheduledPostsTable.brandId, brandId))
    .orderBy(desc(scheduledPostsTable.scheduledFor));
  res.json(posts);
});

router.post("/schedule/create", async (req, res): Promise<void> => {
  const { brandId, platform, postType, caption, hashtags, mediaUrls, scheduledFor, timezone, contentId, designId } = req.body;
  if (!brandId || !platform || !postType || !scheduledFor) {
    res.status(400).json({ error: "brandId, platform, postType, scheduledFor are required" });
    return;
  }

  const userId = (req as any).user?.id ?? brandId;

  const [post] = await db.insert(scheduledPostsTable).values({
    brandId,
    userId,
    platform,
    postType,
    caption,
    hashtags,
    mediaUrls,
    scheduledFor: new Date(scheduledFor),
    timezone: timezone ?? "Africa/Lagos",
    contentId,
    designId,
    status: "scheduled",
  }).returning();

  res.status(201).json(post);
});

router.patch("/schedule/:postId", async (req, res): Promise<void> => {
  const { postId } = req.params;
  const { caption, scheduledFor, status, platform } = req.body;

  const [updated] = await db.update(scheduledPostsTable)
    .set({ caption, scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined, status, platform })
    .where(eq(scheduledPostsTable.id, postId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/schedule/:postId", async (req, res): Promise<void> => {
  await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, req.params.postId));
  res.status(204).end();
});

// ─── Global Calendar Events ───────────────────────────────────────────────────

router.get("/calendar-events", async (_req, res): Promise<void> => {
  const events = await db.select().from(calendarEventsTable);
  res.json(events);
});

// ─── Calendar Stats ───────────────────────────────────────────────────────────

router.get("/brands/:brandId/calendar-stats", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const all = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.brandId, brandId));

  const scheduledThisWeek = all.filter(p =>
    p.status === "scheduled" && p.scheduledFor >= startOfWeek && p.scheduledFor <= endOfWeek
  ).length;

  const publishedThisMonth = all.filter(p =>
    p.status === "published" && p.scheduledFor >= startOfMonth && p.scheduledFor <= endOfMonth
  ).length;

  const draftsPending = all.filter(p => p.status === "draft").length;

  res.json({ scheduledThisWeek, publishedThisMonth, draftsPending });
});

export default router;
