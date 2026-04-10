-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','growth','pro','agency')),
  is_africa_pricing BOOLEAN DEFAULT false,
  credits_used INTEGER DEFAULT 0,
  credits_limit INTEGER DEFAULT 10,
  stripe_customer_id TEXT,
  paystack_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BRANDS
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  industry TEXT,
  logo_url TEXT,
  continent TEXT DEFAULT 'africa',
  country TEXT DEFAULT 'NG',
  city TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BRAND DNA
CREATE TABLE public.brand_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE NOT NULL,
  formality NUMERIC(3,1) DEFAULT 5,
  energy NUMERIC(3,1) DEFAULT 5,
  humor NUMERIC(3,1) DEFAULT 3,
  boldness NUMERIC(3,1) DEFAULT 5,
  language_register JSONB DEFAULT '{}'::jsonb,
  content_themes JSONB DEFAULT '[]'::jsonb,
  audience_profile JSONB DEFAULT '{}'::jsonb,
  visual_identity JSONB DEFAULT '{}'::jsonb,
  cultural_context JSONB DEFAULT '{}'::jsonb,
  power_words JSONB DEFAULT '[]'::jsonb,
  taglines_found JSONB DEFAULT '[]'::jsonb,
  competitor_signals JSONB DEFAULT '[]'::jsonb,
  website_raw_text TEXT,
  social_raw_data JSONB DEFAULT '{}'::jsonb,
  last_crawled_at TIMESTAMPTZ,
  build_status TEXT DEFAULT 'pending',
  build_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SOCIAL HANDLES
CREATE TABLE public.social_handles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','twitter','facebook','tiktok','linkedin','youtube','whatsapp')),
  handle TEXT NOT NULL,
  profile_url TEXT,
  is_connected BOOLEAN DEFAULT false,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  follower_count INTEGER,
  bio TEXT,
  recent_posts JSONB DEFAULT '[]'::jsonb,
  top_posts JSONB DEFAULT '[]'::jsonb,
  engagement_avg NUMERIC(5,2),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GENERATED CONTENT
CREATE TABLE public.generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL,
  platform TEXT,
  title TEXT,
  content TEXT NOT NULL,
  variations JSONB DEFAULT '[]'::jsonb,
  prompt_used TEXT,
  is_favourite BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  performance JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CONTENT JOBS
CREATE TABLE public.content_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  input_params JSONB DEFAULT '{}'::jsonb,
  result_ids JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VOICE FILES
CREATE TABLE public.voice_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE NOT NULL,
  instruction_note TEXT DEFAULT 'Write like these examples. Match the sentence length, the rhythm, the vocabulary, the level of formality.',
  example_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'empty' CHECK (status IN ('empty','building','ready')),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. VOICE EXAMPLES
CREATE TABLE public.voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('email','social_post','website_copy','whatsapp','ad_copy','customer_response','other')),
  platform TEXT,
  title TEXT,
  content TEXT NOT NULL,
  char_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
  is_pinned BOOLEAN DEFAULT false,
  quality_score NUMERIC(3,1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LESSONS
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  source_content_id UUID REFERENCES public.generated_content(id),
  raw_feedback TEXT NOT NULL,
  lesson_type TEXT NOT NULL CHECK (lesson_type IN ('avoid','always','tone','format','content','platform','cultural','positive')),
  lesson_text TEXT NOT NULL,
  applies_to TEXT[] DEFAULT '{}',
  platform TEXT,
  is_active BOOLEAN DEFAULT true,
  times_applied INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "brands_own" ON public.brands FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "dna_own" ON public.brand_dna FOR ALL USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "handles_own" ON public.social_handles FOR ALL USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "content_own" ON public.generated_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "jobs_own" ON public.content_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "vfiles_own" ON public.voice_files FOR ALL USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "vexamples_own" ON public.voice_examples FOR ALL USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));
CREATE POLICY "lessons_own" ON public.lessons FOR ALL USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
