import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, generatedDesignsTable } from "@workspace/db";
import { aiJSON, hasAI } from "../lib/ai.js";
import { buildSystemPrompt } from "../lib/generators/shared.js";
import { generateUGCVideo, pollVideoStatus, hasHiggsfield } from "../lib/higgsfield.js";

const router: IRouter = Router();

router.post("/generate/ugc-video", async (req, res): Promise<void> => {
  const {
    brandId,
    productDescription,
    imageUrl,
    style = "ugc",
    platform = "instagram",
    aspectRatio = "9:16",
    duration = "10s",
  } = req.body ?? {};

  if (!brandId || typeof brandId !== "string") {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  if (!productDescription || typeof productDescription !== "string") {
    res.status(400).json({ error: "productDescription is required" });
    return;
  }
  if (!hasHiggsfield()) {
    res.status(503).json({
      error: "HIGGSFIELD_API_KEY not configured",
      code: "missing_key",
    });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  let prompt = productDescription;

  try {
    if (hasAI()) {
      const system = `You are a UGC video creative director specialising in African and emerging-market brands. Write concise, vivid prompts for AI video generation.`;

      const user = `Write a Higgsfield AI video generation prompt for this brand and product.
Brand: ${brand.name} (${brand.industry ?? "business"}, ${brand.country ?? "Nigeria"}).
Style: ${style}.
Product/service: ${productDescription}.
Target platform: ${platform}.
Aspect ratio: ${aspectRatio}.

The video should feel authentic and native to ${platform}. Keep the prompt under 200 words.
Be specific about visual style, setting, mood, and pacing.
Return only the prompt text — no explanation, no labels.`;

      const result = await aiJSON<{ prompt: string }>(system, user + `\n\nReturn JSON: { "prompt": "<your prompt here>" }`, 300);
      prompt = result?.prompt ?? productDescription;
    }
  } catch {
    prompt = productDescription;
  }

  try {
    const job = await generateUGCVideo({
      prompt,
      ...(imageUrl && { imageUrl }),
      style: style as any,
      aspectRatio: aspectRatio as any,
      duration: duration as any,
    });

    await db.insert(generatedDesignsTable).values({
      brandId,
      userId: (req as any).user?.id ?? brandId,
      designType: "ugc_video",
      platform,
      title: `UGC Video — ${productDescription.slice(0, 50)}`,
      promptUsed: prompt,
      imageUrls: [],
    });

    res.json({ jobId: job.jobId, status: job.status, promptUsed: prompt });
  } catch (err: any) {
    console.error("UGC video generation error:", err);
    res.status(500).json({ error: err.message ?? "Video generation failed" });
  }
});

router.get("/generate/ugc-video/status/:jobId", async (req, res): Promise<void> => {
  const { jobId } = req.params;
  if (!jobId) {
    res.status(400).json({ error: "jobId is required" });
    return;
  }
  if (!hasHiggsfield()) {
    res.status(503).json({ error: "HIGGSFIELD_API_KEY not configured", code: "missing_key" });
    return;
  }
  try {
    const result = await pollVideoStatus(jobId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Status check failed" });
  }
});

export default router;
