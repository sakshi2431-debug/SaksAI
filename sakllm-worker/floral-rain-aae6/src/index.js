import { loadKnowledgeBase } from "./knowledgeBase";

const knowledgeBase = loadKnowledgeBase();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function cleanAnswer(text = "") {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeSources(matches = []) {
  const seen = new Set();
  const out = [];

  for (const m of matches) {
    const key = `${m.title || ""}|${m.url || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      title: m.title || "Source",
      section: m.section || "",
      url: m.url || "",
    });
  }

  return out.filter((s) => s.url).slice(0, 6);
}

function extractMetaFromMarkdown(content = "") {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const raw = match[1];
  const lines = raw.split("\n");
  const meta = {};

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }

  return meta;
}

function stripFrontmatter(content = "") {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function findRelevantDoc(question, docs = []) {
  const q = question.toLowerCase();

  // first: exact slug match
  const bySlug = docs.find((doc) => q.includes(doc.slug.toLowerCase()));
  if (bySlug) return bySlug;

  // second: title/keywords from frontmatter
  for (const doc of docs) {
    const meta = extractMetaFromMarkdown(doc.content);
    const title = (meta.title || "").toLowerCase();
    const keywords = (meta.keywords || "")
      .toLowerCase()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (title && q.includes(title)) return doc;
    if (keywords.some((k) => q.includes(k))) return doc;
  }

  return null;
}

function buildDocSource(doc) {
  const meta = extractMetaFromMarkdown(doc.content);

  return {
    title: meta.title || doc.slug,
    section: meta.project_type || meta.role || "Knowledge Base",
    url: meta.url || "",
  };
}

function buildDocContext(doc) {
  const meta = extractMetaFromMarkdown(doc.content);
  const body = stripFrontmatter(doc.content);

  return `SOURCE 1
Title: ${meta.title || doc.slug}
Role: ${meta.role || ""}
Project Type: ${meta.project_type || ""}
Timeline: ${meta.timeline || ""}
Tools: ${meta.tools || ""}
URL: ${meta.url || ""}
Content:
${body}`;
}

function buildSupabaseContext(matches = []) {
  return matches
    .slice(0, 6)
    .map((m, i) => {
      const notes = clean(m.content).slice(0, 500);
      return `SOURCE ${i + 1}
Title: ${m.title || "Untitled"}
URL: ${m.url || ""}
Section: ${m.section || ""}
Notes: ${notes}`;
    })
    .join("\n\n");
}

async function askLLM({ env, question, context }) {
  const system = `You are Sakshi Rane (UX/UI Designer). Write like Sakshi talking on her portfolio site: warm, confident, specific, and conversational.

Hard rules:
- Use ONLY the provided sources.
- Do not invent facts.
- If the answer is not in the sources, say so clearly.
- Keep the answer concise unless the user asks for depth.
- Always include at least one relevant URL naturally in the answer if one exists in the sources.
- Return valid JSON only. No markdown fences. No extra commentary.

Style:
- First-person ("I", "my").
- Sound like you're explaining your work to a recruiter or collaborator browsing your portfolio.
- Make it feel natural and human, not robotic.
- Use short paragraphs.
- Use 1 concrete detail from the sources when possible.
- End with a soft CTA when it fits.

Return this exact JSON schema:
{
  "answer": "string",
  "followups": ["string", "string", "string"]
}

Followups should be specific, clickable next questions based on the source content.`;

  const user = `User question: ${question}

Use only these sources:
${context}`;

  const provider = env.LLM_PROVIDER || "groq";
  const model =
    env.LLM_MODEL ||
    (provider === "openrouter"
      ? "meta-llama/llama-3-8b-instruct"
      : "llama-3.1-8b-instant");

  const endpoint =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

  const llmResp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": "https://sakshirane.com",
            "X-Title": "SaksAI",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: 800,
    }),
  });

  const llmJson = await llmResp.json();

  if (!llmResp.ok) {
    throw new Error(
      llmJson?.error?.message || llmJson?.message || "LLM request failed"
    );
  }

  const raw = llmJson?.choices?.[0]?.message?.content || "";

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { answer: raw, followups: [] };
  }

  return {
    answer: cleanAnswer(parsed?.answer || ""),
    followups: Array.isArray(parsed?.followups)
      ? parsed.followups.slice(0, 3)
      : [],
  };
}

async function searchSupabase(env, question) {
  const supabaseResp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/search_documents`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: question, match_count: 8 }),
    }
  );

  const matches = await supabaseResp.json();

  console.log("Supabase status:", supabaseResp.status);
  console.log("Supabase matches type:", typeof matches);
  console.log(
    "Supabase matches length:",
    Array.isArray(matches) ? matches.length : "not array"
  );
  console.log("Supabase sample:", Array.isArray(matches) ? matches[0] : matches);

  if (!supabaseResp.ok) {
    throw new Error(matches?.message || "Supabase error");
  }

  return Array.isArray(matches) ? matches : [];
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const isChatRoute = url.pathname === "/" || url.pathname === "/api/chat";

    if (!isChatRoute) {
      return json({ error: `Not found: ${url.pathname}` }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405);
    }

    const body = await request.json().catch(() => ({}));
    const question = (body.message || "").trim();

    if (!question) {
      return json({ error: "Missing message" }, 400);
    }

    try {
      // 1) Try structured markdown knowledge base first
      const matchedDoc = findRelevantDoc(question, knowledgeBase);

      if (matchedDoc) {
        const docSource = buildDocSource(matchedDoc);
        const context = buildDocContext(matchedDoc);

        const llmResult = await askLLM({
          env,
          question,
          context,
        });

        return json({
          answer: llmResult.answer,
          bullets: [],
          sources: docSource.url ? [docSource] : [],
          followups: llmResult.followups,
        });
      }

      // 2) Fallback to Supabase vector search
      const matches = await searchSupabase(env, question);

      if (!matches.length) {
        return json({
          answer:
            "I couldn’t find that in my portfolio knowledge yet. Try asking about LawSpeak AI, ERbuddy, Amazon Music, SVA Research, or my design process.",
          bullets: [],
          sources: [],
          followups: [
            "What makes your design approach unique?",
            "Tell me about LawSpeak AI.",
            "What was your role on ERbuddy?",
          ],
        });
      }

      const sources = dedupeSources(matches);
      const context = buildSupabaseContext(matches);

      const llmResult = await askLLM({
        env,
        question,
        context,
      });

      return json({
        answer: llmResult.answer,
        bullets: [],
        sources,
        followups: llmResult.followups,
      });
    } catch (error) {
      console.error("Worker error:", error);

      return json(
        {
          error: error?.message || "Unexpected server error",
          answer:
            "Something broke while generating the answer. Please try again.",
          bullets: [],
          sources: [],
          followups: [],
        },
        500
      );
    }
  },
};