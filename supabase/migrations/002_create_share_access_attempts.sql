-- AUTH-VULN-03: Rate limiting table for share password attempts
-- 5 failed attempts per share_token per 15 minutes
-- RLS enabled with no policies = only service_role can access

CREATE TABLE public.share_access_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_attempts_token ON public.share_access_attempts(share_token);

ALTER TABLE public.share_access_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role access
