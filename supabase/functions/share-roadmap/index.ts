import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LINEAR_API = "https://api.linear.app/graphql";
const MAX_EXPIRY_DAYS = 90;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PASSWORD_ATTEMPTS = 5;
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

// --- PBKDF2 password hashing (AUTH-VULN-02 fix) ---

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

async function hashPasswordPBKDF2(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256,
  );
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  if (stored.startsWith("pbkdf2:")) {
    const [, saltHex, expectedHash] = stored.split(":");
    const salt = fromHex(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial, 256,
    );
    return constantTimeEqual(toHex(new Uint8Array(bits)), expectedHash);
  } else {
    // Legacy SHA-256 format — verify then caller re-hashes
    const data = new TextEncoder().encode(pw + "ganttsmart-salt-2024");
    const buf = await crypto.subtle.digest("SHA-256", data);
    return constantTimeEqual(toHex(new Uint8Array(buf)), stored);
  }
}

// --- Rate limiting (AUTH-VULN-03 fix) ---

async function checkRateLimit(supabase: ReturnType<typeof createClient>, shareToken: string): Promise<{ blocked: boolean; retryAfterSeconds?: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("share_access_attempts")
    .select("*")
    .eq("share_token", shareToken)
    .gte("first_attempt_at", windowStart)
    .order("first_attempt_at", { ascending: false })
    .limit(1)
    .single();

  if (data && data.attempt_count >= MAX_PASSWORD_ATTEMPTS) {
    const lockedUntil = new Date(new Date(data.first_attempt_at).getTime() + RATE_LIMIT_WINDOW_MS);
    const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
    if (retryAfterSeconds > 0) return { blocked: true, retryAfterSeconds };
  }
  return { blocked: false };
}

async function recordFailedAttempt(supabase: ReturnType<typeof createClient>, shareToken: string): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("share_access_attempts")
    .select("id, attempt_count")
    .eq("share_token", shareToken)
    .gte("first_attempt_at", windowStart)
    .order("first_attempt_at", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    await supabase.from("share_access_attempts")
      .update({ attempt_count: data.attempt_count + 1, last_attempt_at: new Date().toISOString() })
      .eq("id", data.id);
  } else {
    await supabase.from("share_access_attempts")
      .insert({ share_token: shareToken });
  }
}

// --- GraphQL with variables (INJ-VULN-01 fix) ---

// Match the main app's start-date convention: `start: DD-MM-YY` written into issue descriptions
// by updateIssueStartDate (src/api/linear.ts). Returns YYYY-MM-DD or null.
function parseStartDate(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(/start:\s*(\d{2})-(\d{2})-(\d{2})/i);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  const year = 2000 + parseInt(yy);
  const month = parseInt(mm);
  const day = parseInt(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function fetchLinearData(apiKey: string, projectId: string) {
  const query = `query($id: String!) {
    project(id: $id) {
      name
      targetDate
      issues(first: 250, filter: { completedAt: { null: true } }) {
        nodes {
          id identifier title description dueDate priority url completedAt
          state { name type }
          assignee { name }
        }
      }
      doneIssues: issues(first: 100, filter: { completedAt: { null: false } }) {
        nodes {
          id identifier title description dueDate priority url completedAt
          state { name type }
          assignee { name }
        }
      }
    }
  }`;

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables: { id: projectId } }),
  });

  if (!res.ok) throw new Error(`Linear API returned ${res.status}`);
  const result = await res.json();
  if (result.errors) throw new Error(result.errors[0].message);

  const project = result.data?.project;
  if (!project) throw new Error("Project not found");

  // Effective due: explicit dueDate, falling back to project target date (parity with main app).
  const projectTargetDate: string | null = project.targetDate || null;
  function effectiveDue(n: any): { date: string; isImplicit: boolean } | null {
    if (n.dueDate) return { date: n.dueDate, isImplicit: false };
    if (projectTargetDate) return { date: projectTargetDate, isImplicit: true };
    return null;
  }

  function mapNode(n: any, due: string, isDueImplicit: boolean) {
    return {
      id: n.identifier,
      uuid: n.id,
      title: n.title,
      description: n.description || "",
      due,
      startDate: parseStartDate(n.description),
      priorityVal: n.priority,
      priority: PRIORITY_MAP[n.priority] || "None",
      status: n.state?.name || "",
      statusType: n.state?.type || "",
      assignee: n.assignee?.name || "Unassigned",
      url: n.url || "",
      teamId: "",
      blocks: [],
      blockedBy: [],
      progress: 0,
      totalChildren: 0,
      completedChildren: 0,
      completedAt: n.completedAt || undefined,
      isDueImplicit: isDueImplicit || undefined,
    };
  }

  const tasks = project.issues.nodes
    .map((n: any) => {
      const eff = effectiveDue(n);
      return eff ? mapNode(n, eff.date, eff.isImplicit) : null;
    })
    .filter((t: any) => t !== null)
    .sort((a: any, b: any) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime());

  const doneTasks = (project.doneIssues?.nodes || [])
    .map((n: any) => {
      const eff = effectiveDue(n);
      return eff ? mapNode(n, eff.date, eff.isImplicit) : null;
    })
    .filter((t: any) => t !== null)
    .sort((a: any, b: any) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });

  return { tasks, doneTasks, milestones: [], projectName: project.name };
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

      const days = Math.min(Math.max(1, body.expiresInDays || 3), MAX_EXPIRY_DAYS);
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
      const passwordHash = body.password ? await hashPasswordPBKDF2(body.password) : null;

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
        // Rate limit check
        const rateCheck = await checkRateLimit(supabase, shareToken);
        if (rateCheck.blocked) {
          return json({ error: "Too many attempts. Try again later.", retryAfterSeconds: rateCheck.retryAfterSeconds }, 429);
        }

        if (!password) return json({ needsPassword: true, projectName: share.project_name });

        const valid = await verifyPassword(password, share.password_hash);
        if (!valid) {
          await recordFailedAttempt(supabase, shareToken);
          return json({ error: "Incorrect password", needsPassword: true }, 403);
        }

        // Migrate legacy SHA-256 hash to PBKDF2 on successful verification
        if (!share.password_hash.startsWith("pbkdf2:")) {
          const newHash = await hashPasswordPBKDF2(password);
          await supabase.from("shared_roadmaps").update({ password_hash: newHash }).eq("id", share.id);
        }
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
