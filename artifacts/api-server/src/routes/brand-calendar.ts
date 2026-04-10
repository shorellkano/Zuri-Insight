import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, brandCalendarEventsTable, peopleAssetsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Brand Calendar Events ────────────────────────────────────────────────────

router.get("/brands/:brandId/calendar-events", async (req, res): Promise<void> => {
  const events = await db.select().from(brandCalendarEventsTable)
    .where(eq(brandCalendarEventsTable.brandId, req.params.brandId))
    .orderBy(brandCalendarEventsTable.eventDate);
  res.json(events);
});

router.post("/brands/:brandId/calendar-events", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { name, eventType, eventDate, isRecurring, personName, personRole, peopleAssetId, notes, autoGenerate, leadDays } = req.body;
  if (!name || !eventDate) { res.status(400).json({ error: "name and eventDate required" }); return; }

  const [event] = await db.insert(brandCalendarEventsTable).values({
    brandId, name, eventType, eventDate, isRecurring: isRecurring ?? true,
    personName, personRole, peopleAssetId, notes,
    autoGenerate: autoGenerate ?? true, leadDays: leadDays ?? 1,
  }).returning();

  res.status(201).json(event);
});

router.patch("/brands/:brandId/calendar-events/:eventId", async (req, res): Promise<void> => {
  const { name, eventType, eventDate, isRecurring, personName, personRole, notes, autoGenerate, leadDays } = req.body;
  const [updated] = await db.update(brandCalendarEventsTable)
    .set({ name, eventType, eventDate, isRecurring, personName, personRole, notes, autoGenerate, leadDays })
    .where(and(eq(brandCalendarEventsTable.id, req.params.eventId), eq(brandCalendarEventsTable.brandId, req.params.brandId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/brands/:brandId/calendar-events/:eventId", async (req, res): Promise<void> => {
  await db.delete(brandCalendarEventsTable)
    .where(and(eq(brandCalendarEventsTable.id, req.params.eventId), eq(brandCalendarEventsTable.brandId, req.params.brandId)));
  res.status(204).end();
});

// ─── People Assets ────────────────────────────────────────────────────────────

router.get("/brands/:brandId/people-assets", async (req, res): Promise<void> => {
  const people = await db.select().from(peopleAssetsTable)
    .where(eq(peopleAssetsTable.brandId, req.params.brandId))
    .orderBy(desc(peopleAssetsTable.createdAt));
  res.json(people);
});

router.post("/brands/:brandId/people-assets", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { name, role, photoUrl } = req.body;
  if (!name || !photoUrl) { res.status(400).json({ error: "name and photoUrl required" }); return; }

  const [person] = await db.insert(peopleAssetsTable).values({ brandId, name, role, photoUrl }).returning();
  res.status(201).json(person);
});

router.delete("/brands/:brandId/people-assets/:personId", async (req, res): Promise<void> => {
  await db.delete(peopleAssetsTable)
    .where(and(eq(peopleAssetsTable.id, req.params.personId), eq(peopleAssetsTable.brandId, req.params.brandId)));
  res.status(204).end();
});

export default router;
