-- 003: Add nullable user_id to brands for owner-based access control
-- This column links each brand to a Supabase auth user.
-- Nullable to preserve backwards compatibility with pre-existing brands.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);
