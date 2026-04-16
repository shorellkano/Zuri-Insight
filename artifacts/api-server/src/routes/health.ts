import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

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

export default router;
