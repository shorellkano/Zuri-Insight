-- 002: Add social_connections table for Instagram (and future platform) OAuth tokens
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  ig_user_id TEXT,
  ig_username TEXT,
  page_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_brand_id
  ON public.social_connections(brand_id);
