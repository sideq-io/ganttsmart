-- Task baselines: stores the first-seen planned dates for each task per user.
-- Used to compare "what was planned" vs "what actually happened".

CREATE TABLE public.task_baselines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id text NOT NULL,          -- Linear issue identifier (e.g. "SEED-6")
  project_id text NOT NULL,        -- Linear project UUID
  planned_start text,              -- Original start date (YYYY-MM-DD) when first seen
  planned_due text NOT NULL,       -- Original due date (YYYY-MM-DD) when first seen
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id)       -- One baseline per user per issue
);

ALTER TABLE public.task_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_baselines" ON public.task_baselines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by project
CREATE INDEX idx_task_baselines_project ON public.task_baselines (user_id, project_id);

-- Index for fast lookups on issue_change_history
CREATE INDEX idx_issue_change_history_issue ON public.issue_change_history (user_id, issue_id);
CREATE INDEX idx_issue_change_history_project ON public.issue_change_history (user_id, project_id);
