import { Router, type IRouter } from "express";
import { createCanvaDesign, getCanvaAssetType, hasCanva } from "../lib/canva.js";

const router: IRouter = Router();

router.get("/canva/status", (_req, res) => {
  res.json({ configured: hasCanva() });
});

router.post("/canva/create-design", async (req, res): Promise<void> => {
  const { title, platform, format, assetType: rawAssetType } = req.body ?? {};

  if (!hasCanva()) {
    res.status(503).json({ error: "Canva API not configured", code: "missing_key" });
    return;
  }

  const assetType = rawAssetType ?? getCanvaAssetType(platform ?? "instagram", format ?? "feed");

  const result = await createCanvaDesign({
    title: title ?? `Zuri AI Design — ${platform ?? "Social Post"}`,
    assetType,
  });

  if (!result) {
    res.status(503).json({ error: "Failed to create Canva design" });
    return;
  }

  res.json(result);
});

export default router;
