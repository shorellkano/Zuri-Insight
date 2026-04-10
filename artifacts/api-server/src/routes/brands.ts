import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, brandsTable, brandDnaTable, contentTable } from "@workspace/db";
import {
  CreateBrandBody,
  UpdateBrandBody,
  GetBrandParams,
  UpdateBrandParams,
  DeleteBrandParams,
  GetBrandDnaParams,
  BuildBrandDnaParams,
  ListBrandContentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/brands", async (req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(desc(brandsTable.createdAt));
  res.json(brands);
});

router.post("/brands", async (req, res): Promise<void> => {
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [brand] = await db.insert(brandsTable).values(parsed.data).returning();
  res.status(201).json(brand);
});

router.get("/brands/:brandId", async (req, res): Promise<void> => {
  const params = GetBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, params.data.brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(brand);
});

router.put("/brands/:brandId", async (req, res): Promise<void> => {
  const params = UpdateBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [brand] = await db.update(brandsTable).set(parsed.data).where(eq(brandsTable.id, params.data.brandId)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json(brand);
});

router.delete("/brands/:brandId", async (req, res): Promise<void> => {
  const params = DeleteBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [brand] = await db.delete(brandsTable).where(eq(brandsTable.id, params.data.brandId)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/brands/:brandId/dna", async (req, res): Promise<void> => {
  const params = GetBrandDnaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, params.data.brandId));
  if (!dna) {
    res.status(404).json({ error: "Brand DNA not found. Please build it first." });
    return;
  }
  res.json(dna);
});

router.post("/brands/:brandId/dna", async (req, res): Promise<void> => {
  const params = BuildBrandDnaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, params.data.brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const dnaData = {
    brandId: params.data.brandId,
    toneOfVoice: "Warm, confident, and culturally authentic — speaks to African consumers with genuine understanding",
    coreValues: ["Authenticity", "Community", "Excellence", "African Pride", "Innovation"],
    targetAudience: brand.targetMarket ?? "African consumers and businesses across the continent",
    uniqueSellingPoints: [
      "Deep cultural resonance with African markets",
      "Quality products/services tailored for local needs",
      "Community-first approach",
    ],
    culturalContext: "Pan-African, celebrating diverse cultures while finding common ground",
    brandPersonality: "Bold, approachable, and trustworthy — like a respected community leader",
    keyMessages: [
      `${brand.name} is built for Africa, by Africans`,
      "Quality you can trust, culture you can feel",
      "Together we build something greater",
    ],
    writingStyle: "Conversational yet professional, with occasional local expressions that resonate authentically",
  };

  const existing = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, params.data.brandId));

  let dna;
  if (existing.length > 0) {
    [dna] = await db.update(brandDnaTable).set({ ...dnaData, builtAt: new Date() }).where(eq(brandDnaTable.brandId, params.data.brandId)).returning();
  } else {
    [dna] = await db.insert(brandDnaTable).values(dnaData).returning();
  }

  await db.update(brandsTable).set({ dnaBuilt: true }).where(eq(brandsTable.id, params.data.brandId));

  res.json(dna);
});

router.get("/brands/:brandId/content", async (req, res): Promise<void> => {
  const params = ListBrandContentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
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
    .where(eq(contentTable.brandId, params.data.brandId))
    .orderBy(desc(contentTable.createdAt));

  res.json(items);
});

export default router;
