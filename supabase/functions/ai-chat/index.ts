import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Simple in-memory rate limiting for guest requests per IP
const guestRequestLog = new Map<string, { count: number; windowStart: number }>();
const GUEST_RATE_LIMIT = 15; // max requests per window
const GUEST_RATE_WINDOW = 10 * 60 * 1000; // 10 minutes
const GUEST_MAX_MESSAGES = 12; // max messages per conversation for guests

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    const token = authHeader?.replace("Bearer ", "") || apiKey;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check if this is a guest request (anon key only, no user JWT)
    const isGuestToken = token === anonKey;
    let isAuthenticatedUser = false;

    if (!isGuestToken) {
      // Verify the JWT is a real user session
      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      isAuthenticatedUser = true;
    }

    // Guest rate limiting
    if (isGuestToken) {
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const now = Date.now();
      const entry = guestRequestLog.get(clientIP);

      if (!entry || now - entry.windowStart > GUEST_RATE_WINDOW) {
        guestRequestLog.set(clientIP, { count: 1, windowStart: now });
      } else {
        entry.count++;
        if (entry.count > GUEST_RATE_LIMIT) {
          return new Response(
            JSON.stringify({ error: "Guest usage limit reached. Please sign up to continue using the AI Navigator." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    const { messages, systemPrompt } = await req.json() as {
      messages: { role: string; content: string }[];
      systemPrompt: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap message count for guests
    const cappedMessages = isGuestToken
      ? messages.slice(-GUEST_MAX_MESSAGES)
      : messages;

    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: "AI service is temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 500,
        temperature: 0.65,
        messages: [{ role: "system", content: systemPrompt }, ...cappedMessages],
      }),
    });

    if (!upstream.ok) {
      console.error("Groq upstream error:", upstream.status, await upstream.text().catch(() => ""));
      return new Response(
        JSON.stringify({ error: "AI service is temporarily unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-chat function error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
