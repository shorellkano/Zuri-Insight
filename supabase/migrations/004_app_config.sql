-- 004: Add app_config table for global application configuration (e.g. Meta OAuth credentials)
-- Values are encrypted at the application layer before insertion.
CREATE TABLE IF NOT EXISTS public.app_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS: deny all direct client access by default.
-- The API server connects via the service role key which bypasses RLS entirely,
-- so all server-side reads/writes via Drizzle continue to work.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No explicit policies are added — the default-deny RLS blocks anon and
-- authenticated clients from reading or writing this table directly.
