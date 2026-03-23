-- AUTH-VULN-01, AUTHZ-VULN-02: Enable RLS on shared_roadmaps
-- Blocks direct PostgREST exfiltration via anon key.
-- Edge Function uses service_role which bypasses RLS.

ALTER TABLE public.shared_roadmaps ENABLE ROW LEVEL SECURITY;

-- Authenticated owner: full CRUD on own rows
CREATE POLICY "owner_all" ON public.shared_roadmaps
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anon role: SELECT only (read access for public shared views)
CREATE POLICY "anon_read" ON public.shared_roadmaps
  FOR SELECT TO anon
  USING (true);
