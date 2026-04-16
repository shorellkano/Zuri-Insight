import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getModelStatus } from "../lib/ai.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/ping", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok", ts: Date.now() });
});

router.get("/ai/status", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const models = getModelStatus();
  const available = models.filter(m => m.available).length;
  const total = models.length;
  res.json({
    available,
    total,
    healthy: available > 0,
    models,
    message: available === 0
      ? "All models cooling down - try again in 90 seconds"
      : `${available}/${total} models available`,
  });
});

export default router;
