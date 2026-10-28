import { loadKnowledgeBase } from "../../sakllm-worker/floral-rain-aae6/src/knowledgeBase.js";
import { findRelevantDoc, buildDocSource, stripFrontmatter } from "../../sakllm-worker/floral-rain-aae6/src/index.js";
import { messageFrom, searchDocuments } from "../../sakllm-worker/floral-rain-aae6/src/security.js";

function clean(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function snippet(text, max = 240) {
  const t = clean(text);
  return t.length <= max ? t : t.slice(0, max).trim() + "…";
}

function makeSummary(matches) {
  const strong = matches.slice(0, 2).map((m) => clean(m.content)).join(" ");
  const sentences = strong.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ") || snippet(strong, 260);
}

function dedupeSources(matches) {
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const key = `${m.title}|${m.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: m.title, section: m.section, url: m.url });
  }
  return out.slice(0, 6);
}

function followUps(message) {
  const q = (message || "").toLowerCase();
  if (q.includes("erbuddy")) {
    return ["What was your role on ERbuddy?", "What features did you design?", "What was the outcome?"];
  }
  return ["Tell me about ERbuddy", "What are your UX strengths?", "What projects show accessibility work?"];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  let message;
  try { message = messageFrom(req.body); }
  catch { return res.status(400).json({ error: "Provide a message (1–4000 characters)" }); }

  let matches;
  try {
    const doc = findRelevantDoc(message, loadKnowledgeBase());
    matches = doc ? [{ ...buildDocSource(doc), content: stripFrontmatter(doc.content) }] : await searchDocuments(process.env, message);
  }
  catch { return res.status(503).json({ error: "Search is temporarily unavailable" }); }

  if (!matches || matches.length === 0) {
    return res.status(200).json({
      answer: "I couldn’t find that in my portfolio content yet. Try asking about a specific project or my role.",
      bullets: [],
      sources: [],
      followUps: followUps(message)
    });
  }

  return res.status(200).json({
    answer: makeSummary(matches),
    bullets: matches.slice(0, 3).map((m) => snippet(m.content, 220)),
    sources: dedupeSources(matches),
    followUps: followUps(message)
  });
}

export const config = { api: { bodyParser: { sizeLimit: "20kb" } } };
