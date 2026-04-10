import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, voiceExamplesTable, lessonsTable, brandsTable } from "@workspace/db";
import { aiComplete, hasAI } from "../lib/ai.js";

const router: IRouter = Router();

// ─── Voice Examples ───────────────────────────────────────────────────────────

router.get("/brands/:brandId/voice", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const examples = await db
    .select()
    .from(voiceExamplesTable)
    .where(eq(voiceExamplesTable.brandId, brandId))
    .orderBy(desc(voiceExamplesTable.isPinned), desc(voiceExamplesTable.createdAt));
  res.json(examples);
});

router.post("/brands/:brandId/voice", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { text, title, contentType, platform, bulkTexts } = req.body;

  // Bulk import mode
  if (Array.isArray(bulkTexts) && bulkTexts.length > 0) {
    const rows = bulkTexts
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 10)
      .map((t: string) => ({ brandId, text: t, contentType, platform }));

    if (rows.length === 0) {
      res.status(400).json({ error: "No valid examples found after splitting." });
      return;
    }

    const inserted = await db.insert(voiceExamplesTable).values(rows).returning();
    res.status(201).json(inserted);
    return;
  }

  // Single example
  if (!text || text.trim().length < 5) {
    res.status(400).json({ error: "Content is required (minimum 5 characters)." });
    return;
  }

  const [example] = await db
    .insert(voiceExamplesTable)
    .values({ brandId, text: text.trim(), title: title?.trim() || null, contentType, platform })
    .returning();

  res.status(201).json(example);
});

router.patch("/brands/:brandId/voice/:exampleId/pin", async (req, res): Promise<void> => {
  const { brandId, exampleId } = req.params;
  const [current] = await db
    .select({ isPinned: voiceExamplesTable.isPinned })
    .from(voiceExamplesTable)
    .where(and(eq(voiceExamplesTable.id, exampleId), eq(voiceExamplesTable.brandId, brandId)));

  if (!current) { res.status(404).json({ error: "Example not found" }); return; }

  const [updated] = await db
    .update(voiceExamplesTable)
    .set({ isPinned: !current.isPinned })
    .where(eq(voiceExamplesTable.id, exampleId))
    .returning();

  res.json(updated);
});

router.delete("/brands/:brandId/voice/:exampleId", async (req, res): Promise<void> => {
  const { brandId, exampleId } = req.params;
  await db
    .delete(voiceExamplesTable)
    .where(and(eq(voiceExamplesTable.id, exampleId), eq(voiceExamplesTable.brandId, brandId)));
  res.status(204).end();
});

// ─── Lessons ──────────────────────────────────────────────────────────────────

router.get("/brands/:brandId/lessons", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(eq(lessonsTable.brandId, brandId))
    .orderBy(desc(lessonsTable.createdAt));
  res.json(lessons);
});

router.post("/brands/:brandId/lessons", async (req, res): Promise<void> => {
  const { brandId } = req.params;
  const { feedback, contentType, platform, sourceContent, manual, lessonType: manualType } = req.body;

  if (!feedback || feedback.trim().length < 5) {
    res.status(400).json({ error: "Feedback is required." });
    return;
  }

  let rule = feedback.trim();
  let lessonType = manualType ?? "ALWAYS DO";

  // Use AI to parse feedback into a structured lesson (unless it's a manual direct add)
  if (!manual && hasAI()) {
    try {
      const system = `You are a brand voice trainer. Convert raw user feedback into a clear, specific, actionable lesson rule.

LESSON TYPES:
- NEVER DO: things the AI should never do
- ALWAYS DO: things the AI should always do  
- TONE RULES: rules about voice, energy, formality
- FORMAT RULES: rules about structure, length, layout
- CONTENT RULES: rules about what topics or messages to include/exclude
- CULTURAL RULES: rules about cultural context, idioms, references
- WHAT WORKS: proven approaches that should be repeated

Return ONLY valid JSON (no markdown fences):
{
  "lessonType": "<one of the 7 types above>",
  "rule": "<concise, specific, actionable rule in under 100 words. Start with an action verb.>"
}`;

      const user = `Raw feedback: "${feedback}"
${sourceContent ? `Source content the feedback was about:\n"${sourceContent.substring(0, 300)}"` : ""}
${contentType ? `Content type: ${contentType}` : ""}`;

      const raw = await aiComplete(system, user, 300);
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      rule = parsed.rule ?? rule;
      lessonType = parsed.lessonType ?? lessonType;
    } catch {
      // Fall back to raw feedback as the rule
    }
  }

  const [lesson] = await db
    .insert(lessonsTable)
    .values({ brandId, rule, lessonType, contentType: contentType || null, platform: platform || null })
    .returning();

  res.status(201).json(lesson);
});

router.patch("/brands/:brandId/lessons/:lessonId/toggle", async (req, res): Promise<void> => {
  const { brandId, lessonId } = req.params;
  const [current] = await db
    .select({ isActive: lessonsTable.isActive })
    .from(lessonsTable)
    .where(and(eq(lessonsTable.id, lessonId), eq(lessonsTable.brandId, brandId)));

  if (!current) { res.status(404).json({ error: "Lesson not found" }); return; }

  const [updated] = await db
    .update(lessonsTable)
    .set({ isActive: !current.isActive })
    .where(eq(lessonsTable.id, lessonId))
    .returning();

  res.json(updated);
});

router.delete("/brands/:brandId/lessons/:lessonId", async (req, res): Promise<void> => {
  const { brandId, lessonId } = req.params;
  await db
    .delete(lessonsTable)
    .where(and(eq(lessonsTable.id, lessonId), eq(lessonsTable.brandId, brandId)));
  res.status(204).end();
});

export default router;
