import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LINEAR_API = "https://api.linear.app/graphql";
const MAX_EXPIRY_DAYS = 90;
const PRIORITY_MAP: Record<number, string> = { 0: "None", 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode(pw + "ganttsmart-salt-2024");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchLinearData(apiKey: string, projectId: string) {
  const query = `query { project(id: "${projectId}") { name issues(first: 250, filter: { completedAt: { null: true } }) { nodes { id identifier title description dueDate priority state { name type } assignee { name } } } } }`;

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Linear API returned ${res.status}`);
  const result = await res.json();
  if (result.errors) throw new Error(result.errors[0].message);

  const project = result.data?.project;
  if (!project) throw new Error("Project not found");

  const tasks = project.issues.nodes
    .filter((n: any) => n.dueDate)
    .map((n: any) => {
      const startMatch = n.description?.match(/\[start:\s*(\d{4}-\d{2}-\d{2})\]/);
      return {
        id: n.identifier, uuid: n.id, title: n.title,
        description: n.description || "", due: n.dueDate,
        startDate: startMatch ? startMatch[1] : null,
        priorityVal: n.priority, priority: PRIORITY_MAP[n.priority] || "None",
        status: n.state?.name || "", statusType: n.state?.type || "",
        assignee: n.assignee?.name || "Unassigned",
        url: "", teamId: "",
        blocks: [], blockedBy: [],
        progress: 0, totalChildren: 0, completedChildren: 0,
      };
    })
    .sort((a: any, b: any) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime());

  return { tasks, milestones: [], projectName: project.name };
}

async function getUser(req: Request) {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user } } = await sb.auth.getUser(h.replace("Bearer ", ""));
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const projectId = body.projectId;
      if (!projectId) return json({ error: "projectId required" }, 400);

      const days = Math.min(Math.max(1, body.expiresInDays || 30), MAX_EXPIRY_DAYS);
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      const { data: settings } = await supabase.from("user_settings").select("linear_access_token").eq("id", user.id).single();
      if (!settings?.linear_access_token) return json({ error: "No Linear token. Connect Linear first." }, 400);

      let cachedData;
      try {
        cachedData = await fetchLinearData(settings.linear_access_token, projectId);
      } catch (e) {
        return json({ error: "Failed to fetch Linear data: " + (e as Error).message }, 500);
      }

      const shareToken = crypto.randomUUID();
      const passwordHash = body.password ? await hashPassword(body.password) : null;

      const { data: share, error: err } = await supabase.from("shared_roadmaps").insert({
        owner_id: user.id, project_id: projectId, project_name: cachedData.projectName,
        share_token: shareToken, password_hash: passwordHash,
        expires_at: expiresAt, cached_data: cachedData, cached_at: new Date().toISOString(),
      }).select("id, share_token, project_name, expires_at, cached_at, password_hash").single();

      if (err) return json({ error: "DB insert failed: " + err.message }, 500);

      return json({ id: share.id, shareToken: share.share_token, projectName: share.project_name, expiresAt: share.expires_at, cachedAt: share.cached_at, hasPassword: !!share.password_hash });
    }

    if (action === "get") {
      const { shareToken, password } = body;
      if (!shareToken) return json({ error: "shareToken required" }, 400);

      const { data: share } = await supabase.from("shared_roadmaps").select("*").eq("share_token", shareToken).single();
      if (!share) return json({ error: "Share not found" }, 404);
      if (new Date(share.expires_at) < new Date()) return json({ error: "This shared link has expired", expired: true }, 410);

      if (share.password_hash) {
        if (!password) return json({ needsPassword: true, projectName: share.project_name });
        const h = await hashPassword(password);
        if (h !== share.password_hash) return json({ error: "Incorrect password", needsPassword: true }, 403);
      }

      return json({ projectName: share.project_name, cachedData: share.cached_data, cachedAt: share.cached_at, expiresAt: share.expires_at });
    }

    if (action === "list") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      let q = supabase.from("shared_roadmaps").select("id, share_token, project_id, project_name, expires_at, cached_at, password_hash, created_at").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (body.projectId) q = q.eq("project_id", body.projectId);

      const { data, error: err } = await q;
      if (err) return json({ error: err.message }, 500);

      return json({ shares: (data || []).map((s: any) => ({ id: s.id, shareToken: s.share_token, projectId: s.project_id, projectName: s.project_name, expiresAt: s.expires_at, cachedAt: s.cached_at, hasPassword: !!s.password_hash, createdAt: s.created_at })) });
    }

    if (action === "refresh") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { shareId } = body;
      if (!shareId) return json({ error: "shareId required" }, 400);

      const { data: share } = await supabase.from("shared_roadmaps").select("project_id").eq("id", shareId).eq("owner_id", user.id).single();
      if (!share) return json({ error: "Share not found" }, 404);

      const { data: settings } = await supabase.from("user_settings").select("linear_access_token").eq("id", user.id).single();
      if (!settings?.linear_access_token) return json({ error: "No Linear token" }, 400);

      const cachedData = await fetchLinearData(settings.linear_access_token, share.project_id);
      await supabase.from("shared_roadmaps").update({ cached_data: cachedData, cached_at: new Date().toISOString() }).eq("id", shareId);
      return json({ success: true, cachedAt: new Date().toISOString() });
    }

    if (action === "delete") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { shareId } = body;
      if (!shareId) return json({ error: "shareId required" }, 400);
      await supabase.from("shared_roadmaps").delete().eq("id", shareId).eq("owner_id", user.id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
