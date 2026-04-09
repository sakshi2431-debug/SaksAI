import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

console.log("✅ index.js started (NO OPENAI)");

// --- 1) Env checks ---
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FRAMER_SITE_BASE_URL"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
  console.error("❌ Missing env vars in .env:", missing.join(", "));
  console.error("Fix: open .env and add them, then rerun.");
  process.exit(1);
}

// --- 2) Supabase client ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 3) Helpers ---
function chunkText(text, maxChars = 1800) {
  // Split by blank lines, then pack paragraphs into ~maxChars chunks
  const parts = text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);

  const chunks = [];
  let buf = "";

  for (const p of parts) {
    const next = buf ? buf + "\n\n" + p : p;
    if (next.length > maxChars) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = p;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function safeSlug(name) {
  return name
    .toLowerCase()
    .replace(/\.md$/i, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFilename(file) {
  return file
    .replace(/\.md$/i, "")
    .replace(/[-_]/g, " ")
    .trim();
}

async function clearDocuments() {
  console.log("🧹 Clearing old documents...");
  const { error } = await supabase.from("documents").delete().neq("id", 0);
  if (error) {
    console.warn("⚠️ Could not clear documents (not fatal):", error.message);
  }
}

async function insertChunk({ title, section, url, content }) {
  const { error } = await supabase.from("documents").insert({
    title,
    section,
    url,
    content,
    embedding: null, // NO OPENAI embeddings yet
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// --- 4) Main ---
async function main() {
  const knowledgeDir = path.join(process.cwd(), "portfolio-knowledge");
  console.log("📁 Looking for folder:", knowledgeDir);

  if (!fs.existsSync(knowledgeDir)) {
    console.error("❌ portfolio-knowledge folder not found.");
    console.error("Fix: create portfolio-knowledge/ and add .md files.");
    process.exit(1);
  }

  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
  console.log("📝 Found markdown files:", files);

  if (files.length === 0) {
    console.error("❌ No .md files found in portfolio-knowledge/");
    process.exit(1);
  }

  await clearDocuments();

  let inserted = 0;
  let failed = 0;

  for (const file of files) {
    const fullPath = path.join(knowledgeDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");

    const title = titleFromFilename(file);
    const slug = safeSlug(file);
    const base = process.env.FRAMER_SITE_BASE_URL.replace(/\/+$/, "");
    const url = `${base}/${slug}`;

    const chunks = chunkText(raw);
    console.log(`📄 Indexing ${file} → ${chunks.length} chunks`);

    for (const chunk of chunks) {
      // Basic section detection (optional)
      const sectionMatch = chunk.match(/^##\s+(.+)$/m);
      const section = sectionMatch ? sectionMatch[1].trim() : "General";

      const result = await insertChunk({
        title,
        section,
        url,
        content: chunk,
      });

      if (result.ok) inserted++;
      else {
        failed++;
        console.log("❌ Insert failed:", result.error);
      }
    }
  }

  console.log(`✅ Done. Inserted ${inserted} chunks. Failed: ${failed}.`);
}

main().catch((e) => {
  console.error("❌ Script crashed:", e?.message || e);
  process.exit(1);
});
