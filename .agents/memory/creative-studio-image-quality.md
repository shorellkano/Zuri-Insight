---
name: Creative Studio image quality
description: Findings on AI image generation quality for FLUX and SDXL models on Together AI
---

## Rule
Use `black-forest-labs/FLUX.1-schnell` at 4 steps with photography-first prompts. Do NOT use SDXL base or attempt FLUX.1-dev.

**Why:**
- `FLUX.1-dev` requires a dedicated endpoint on Together AI — it is NOT available as a serverless model. Attempting it returns a 400 "model_not_available" error.
- `stabilityai/stable-diffusion-xl-base-1.0` is serverless and available, but the base weights (without photorealism LoRA) produce blurry/soft images even with `(sharp focus:1.5)` negative prompts and 35 steps. Not suitable for human subjects.
- `FLUX.1-schnell` at 4 steps with photography-first prompts produces sharp, photorealistic images of African people. The prompt, not the step count, was the original quality problem.

## How to apply
- `generateImage()` in `artifacts/api-server/src/lib/ai.ts` — keep model as `black-forest-labs/FLUX.1-schnell`, steps=4, resolution snapped to multiples of 32, max 1440.
- `buildDNAFluxPrompt()` in `creative-studio.ts` — prompt must start with a scene that begins "photograph of [African person] doing [action] in [place]", followed by lighting, camera model, and quality keywords. No abstract brand-concept language.
- All 6 route `imageScene` AI prompts must request: "start with 'photograph of' then describe a specific realistic scene — African person, action, setting, lighting".
- Lighting map must NOT include "bokeh" (causes blur in SDXL, unnecessary in FLUX). Use "sharp focus", "crisp detail" instead.
