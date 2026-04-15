import { Router } from "express";
import { hasGamma, startGammaGeneration, pollGammaGeneration } from "../lib/gamma.js";

const router = Router();

router.get("/gamma/status", (_req, res) => {
  res.json({ configured: hasGamma() });
});

router.post("/gamma/generate", async (req, res) => {
  try {
    if (!hasGamma()) {
      res.status(503).json({ error: "Gamma is not configured. Add your GAMMA_API_KEY to enable this feature." });
      return;
    }
    const { inputText, format = "presentation", numCards = 8, textMode = "condense", tone, textDensity = "medium" } = req.body;
    if (!inputText?.trim()) {
      res.status(400).json({ error: "inputText is required" });
      return;
    }
    const result = await startGammaGeneration({ inputText: String(inputText).trim(), format, numCards, textMode, tone, textDensity });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Gamma generation failed" });
  }
});

router.get("/gamma/poll/:generationId", async (req, res) => {
  try {
    if (!hasGamma()) {
      res.status(503).json({ error: "Gamma is not configured" });
      return;
    }
    const result = await pollGammaGeneration(req.params.generationId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Gamma poll failed" });
  }
});

export default router;
