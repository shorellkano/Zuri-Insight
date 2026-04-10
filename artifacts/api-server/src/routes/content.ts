import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, contentTable, brandsTable } from "@workspace/db";
import { DeleteContentParams, ListContentQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/content", async (req, res): Promise<void> => {
  const params = ListContentQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db
    .select({
      id: contentTable.id,
      type: contentTable.type,
      brandId: contentTable.brandId,
      brandName: brandsTable.name,
      prompt: contentTable.prompt,
      content: contentTable.content,
      platform: contentTable.platform,
      tone: contentTable.tone,
      createdAt: contentTable.createdAt,
    })
    .from(contentTable)
    .innerJoin(brandsTable, eq(contentTable.brandId, brandsTable.id))
    .$dynamic();

  const conditions = [];
  if (params.data.type) {
    conditions.push(eq(contentTable.type, params.data.type));
  }
  if (params.data.brandId) {
    conditions.push(eq(contentTable.brandId, params.data.brandId));
  }

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const items = await query.orderBy(desc(contentTable.createdAt));
  res.json(items);
});

router.delete("/content/:contentId", async (req, res): Promise<void> => {
  const params = DeleteContentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.delete(contentTable).where(eq(contentTable.id, params.data.contentId)).returning();
  if (!item) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
