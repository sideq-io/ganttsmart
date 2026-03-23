import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINEAR_CLIENT_ID = Deno.env.get("LINEAR_CLIENT_ID") ?? "";
const LINEAR_CLIENT_SECRET = Deno.env.get("LINEAR_CLIENT_SECRET") ?? "";
const LINEAR_REDIRECT_URI = Deno.env.get("LINEAR_REDIRECT_URI") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: "Missing authorization code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenRes = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: LINEAR_CLIENT_ID,
        client_secret: LINEAR_CLIENT_SECRET,
        redirect_uri: LINEAR_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      return new Response(JSON.stringify({ error: `Linear token exchange failed: ${errBody}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type || "Bearer";

    const { error: dbError } = await supabaseClient
      .from("user_settings")
      .upsert({
        id: user.id,
        linear_access_token: accessToken,
        linear_token_type: tokenType,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      return new Response(JSON.stringify({ error: `Failed to save token: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
