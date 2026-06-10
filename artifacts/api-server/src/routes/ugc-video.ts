import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, brandVisualPrefsTable, generatedDesignsTable } from "@workspace/db";
import { aiJSON, hasAI } from "../lib/ai.js";
import { generateUGCVideo, pollVideoStatus, hasHiggsfield } from "../lib/higgsfield.js";

const router: IRouter = Router();

function africanCharacterDesc(country?: string | null): string {
  const c = (country ?? "Nigeria").toLowerCase();
  if (c.includes("south africa")) return "South African Black";
  if (c.includes("ghana"))  return "Ghanaian, dark-skinned African";
  if (c.includes("kenya"))  return "Kenyan, dark-skinned African";
  if (c.includes("egypt") || c.includes("morocco") || c.includes("tunisia")) return "North African, brown-skinned";
  if (c.includes("ethiopia")) return "Ethiopian, dark-skinned African";
  if (c.includes("tanzania") || c.includes("uganda") || c.includes("rwanda")) return "East African, dark-skinned";
  return "Nigerian, dark-skinned Black African";
}

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
      error: "HIGGSFIELD_API_KEY not configured — please add it in Secrets to enable video generation.",
      code: "missing_key",
    });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const [prefs] = await db.select().from(brandVisualPrefsTable)
    .where(eq(brandVisualPrefsTable.brandId, brandId))
    .catch(() => [undefined]);
  const colors = prefs?.brandColors?.length ? prefs.brandColors : ["#D97706", "#1C1917", "#FFFFFF"];
  const primaryColor = colors[0] ?? "#D97706";

  const charDesc = africanCharacterDesc(brand.country);

  let prompt = productDescription;

  try {
    if (hasAI()) {
      const system = `You are a UGC video creative director specialising in African and emerging-market brands.
Write concise, vivid prompts for AI video generation (Higgsfield AI).

CRITICAL RULES:
1. Characters MUST reflect the local African market. Always explicitly specify dark-skinned African characters matching the brand's country. NEVER default to Caucasian or light-skinned models.
2. Include brand primary color (${primaryColor}) in the visual styling — clothing accents, product packaging, environment decor, or color grading.
3. Keep the prompt under 180 words, specific, and cinematic.`;

      const user = `Write a Higgsfield AI video generation prompt for this brand.

Brand: ${brand.name}
Industry: ${brand.industry ?? "business"}
Country: ${brand.country ?? "Nigeria"}
Style requested: ${style}
Product/service: ${productDescription}
Platform: ${platform} (${aspectRatio})

CHARACTER REQUIREMENT: The main person/model MUST be described as a "${charDesc}" individual. State this explicitly near the start of the prompt so Higgsfield applies it.

COLOUR: Weave in brand colour ${primaryColor} through their clothing, accessories, background elements or product packaging.

Return JSON: { "prompt": "<your Higgsfield prompt here>" }`;

      const result = await aiJSON<{ prompt: string }>(system, user, 300);
      prompt = result?.prompt ?? productDescription;
    }
  } catch {
    prompt = `${productDescription}. African ${charDesc} person in a vibrant authentic setting. Style: ${style}. Platform: ${platform}.`;
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
      title: `UGC Video - ${productDescription.slice(0, 50)}`,
      promptUsed: prompt,
      imageUrls: [],
    }).catch(() => {});

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
