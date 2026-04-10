import { Router, type IRouter } from "express";
import { desc, count, eq } from "drizzle-orm";
import { db, brandsTable, contentTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [brandCount] = await db.select({ count: count() }).from(brandsTable);
  const [contentCount] = await db.select({ count: count() }).from(contentTable);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [monthlyCount] = await db
    .select({ count: count() })
    .from(contentTable)
    .where(sql`${contentTable.createdAt} >= ${firstOfMonth}`);

  const typeBreakdown = await db
    .select({ type: contentTable.type, count: count() })
    .from(contentTable)
    .groupBy(contentTable.type);

  const mostActiveResult = await db
    .select({ brandId: contentTable.brandId, name: brandsTable.name, cnt: count() })
    .from(contentTable)
    .innerJoin(brandsTable, eq(contentTable.brandId, brandsTable.id))
    .groupBy(contentTable.brandId, brandsTable.name)
    .orderBy(desc(count()))
    .limit(1);

  res.json({
    totalBrands: brandCount?.count ?? 0,
    totalContentGenerated: contentCount?.count ?? 0,
    contentThisMonth: monthlyCount?.count ?? 0,
    mostActiveBrand: mostActiveResult[0]?.name ?? null,
    contentByType: typeBreakdown.map((r) => ({ type: r.type, count: Number(r.count) })),
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const items = await db
    .select({
      id: contentTable.id,
      brandId: contentTable.brandId,
      brandName: brandsTable.name,
      contentType: contentTable.type,
      createdAt: contentTable.createdAt,
    })
    .from(contentTable)
    .innerJoin(brandsTable, eq(contentTable.brandId, brandsTable.id))
    .orderBy(desc(contentTable.createdAt))
    .limit(20);

  const activity = items.map((item) => ({
    id: item.id,
    action: `Generated ${item.contentType} content`,
    brandId: item.brandId,
    brandName: item.brandName,
    contentType: item.contentType,
    createdAt: item.createdAt,
  }));

  res.json(activity);
});

export default router;
