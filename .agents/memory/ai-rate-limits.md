---
name: AI rate limit strategy for OpenRouter free tier
description: How to handle OpenRouter free model rate limits in production with 4 active brands.
---

## Rule
All content-generating routes must have a template fallback that returns usable content when all AI models are rate-limited.

**Why:** OpenRouter free models have ~20-50 req/day/model. With 4 brands generating content, the daily quota exhausts quickly. Without fallbacks, routes crash with HTTP 500.

**Routes with fallbacks:**
- `quick-create` — always had a fallback (inline template)
- `seven-day.ts` — fallback via `buildFallbackDays()` function; brand/weekFocus fetched OUTSIDE the try block so catch block can access them
- `generate.ts quick-plan` — fallback template plan (7/14/24 posts depending on duration)

**Routes still needing fallbacks if AI goes down:** bulk-plan suggest (currently returns 503 which is acceptable).

**How to apply:**
1. Fetch brand data OUTSIDE the try block (so catch block can use it for fallbacks)
2. Detect rate limits: `err?.isRateLimit || msg.includes("429") || msg.includes("busy")`
3. Always return 200 with `isTemplateFallback: true` flag so UI can show a note

## Model cooldown system (ai.ts)
- `modelCooldowns` Map tracks which models are cooling down (90s TTL)
- `availableModels()` filters the 12-model pool to skip cooling ones
- `markModelRateLimited(model)` sets cooldown when 429 is received
- On rate limit: `throw RATE_LIMIT_ERR` with `{ status: 429, isRateLimit: true }`
- Status endpoint: `GET /api/ai/status` shows per-model availability
