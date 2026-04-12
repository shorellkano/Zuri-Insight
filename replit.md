# Zuri AI

## Overview

Zuri AI is an AI-powered marketing content platform for African businesses and global emerging markets. It reads a brand's website/social profiles, builds a Brand DNA intelligence profile, and generates on-brand marketing content: ad copy, social posts, email campaigns, WhatsApp messages, and video scripts.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/zuri-ai) — terracotta/teal/gold branding
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenRouter (`OPENROUTER_API_KEY`) → `anthropic/claude-sonnet-4.6` via OpenAI-compatible SDK
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema (lib/db/src/schema/)

- **brands** — brand profiles (name, website, industry, target market, continent, country, city, language, social handles × 7, dnaBuilt flag)
- **brand_dna** — Brand DNA intelligence profile (tone of voice, core values, target audience, cultural context, etc.)
- **content** — saved generated content (type, brand, prompt, content, platform, tone)
- **media_posts** — uploaded media content for Post Content feature (mediaUrls, mediaType, context, category, callToAction, generatedCaptions jsonb, platforms, postStatus)

## API Endpoints (artifacts/api-server/src/routes/)

- `GET/POST /api/brands` — list/create brands
- `GET/PUT/DELETE /api/brands/:brandId` — brand CRUD
- `GET/POST /api/brands/:brandId/dna` — get/build Brand DNA
- `GET /api/brands/:brandId/content` — list brand content
- `POST /api/generate/quick-create` — Quick Create: platform+format+topic → 1 AI variation (hook/caption/hashtags/keywords), saved to content table with type "quick-create"
- `POST /api/generate/media-post` — Post Content: mediaUrls/context/platforms → per-platform captions saved to media_posts table
- `POST /api/storage/uploads/request-url` — Request a presigned GCS URL for direct file upload (returns uploadURL + objectPath)
- `GET /api/storage/objects/:path` — Serve private uploaded files from object storage
- `POST /api/generate/ad-copy|social-posts|email|whatsapp|video-scripts` — content generation
- `GET /api/content` — content library with type/brand filters
- `DELETE /api/content/:contentId` — delete content
- `GET /api/dashboard/stats` — dashboard statistics
- `GET /api/dashboard/activity` — recent activity feed

## Frontend Pages (artifacts/zuri-ai/src/pages/)

- `/` — Marketing landing page (home.tsx)
- `/quick-create` — **Primary interface**: platform grid + format pills + topic + tone + AI generation, output with hook/caption/hashtags, copy/download/schedule actions. QuickSetup onboarding modal shown to users with 0 brands.
- `/post` — **Post Content (Media First Creation)**: 4-step wizard (Upload media → Context/describe → Select platforms → AI-generated per-platform captions). Files uploaded to Replit Object Storage via presigned URLs. Captions shown in collapsible cards with copy functionality.
- `/dashboard` — Stats, quick-generate, recent activity, brands overview
- `/brands` — Brand grid with DNA status
- `/brands/new` — 4-step brand setup wizard (basics → market/culture → social handles → DNA build animation)
- `/brands/:brandId` — Brand detail with DNA and content tabs
- `/generate` — Content format hub
- `/generate/ad-copy|social-posts|email|whatsapp|video-scripts` — Individual generators
- `/content` — Content library with filters
- `/settings` — Settings page

## Branding

- Primary color: Terracotta (hsl 14 89% 53%)
- Secondary: Deep Teal (hsl 184 89% 25%)
- Accent: Warm Gold (hsl 43 100% 50%)
- Logo: `/zuri-ai-logo.png` (in public/ folder)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
