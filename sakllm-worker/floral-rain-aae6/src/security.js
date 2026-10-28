export function messageFrom(body) {
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    throw new Error("Message must be a non-empty string");
  }
  const message = body.message.trim();
  if (message.length > 4000) throw new Error("Message is too long");
  return message;
}

export function publicSearchHeaders(env) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key || !env.SUPABASE_URL) throw new Error("Search is not configured");
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("sb_publishable_")) return headers;
  // Fail closed if an elevated key is accidentally put in the anon setting.
  // The API verifies the JWT signature; this check only prevents configuration mistakes.
  let role;
  try {
    const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    role = JSON.parse(atob(payload)).role;
  } catch { throw new Error("Search requires a publishable or anon key"); }
  if (role !== "anon") throw new Error("Search requires a publishable or anon key");
  headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function searchDocuments(env, question) {
  if (env.SUPABASE_SEARCH_ENABLED !== "true") throw new Error("Database search is disabled until its policies and content are reviewed");
  const headers = publicSearchHeaders(env);
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("Search requires HTTPS");
  const response = await fetch(new URL("/rest/v1/rpc/search_documents", url), {
    method: "POST", headers,
    body: JSON.stringify({ query: question, match_count: 8 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Search request failed");
  const matches = await response.json();
  if (!Array.isArray(matches)) throw new Error("Invalid search response");
  return matches.filter(m => m && typeof m.content === "string");
}
