import fs from "fs/promises";
import path from "path";
import fg from "fast-glob";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const KNOWLEDGE_DIR = path.resolve("../../portfolio-knowledge");
// Change this only if your table name is different
const TABLE_NAME = "documents";

// Chunk settings
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { metadata: {}, body: content.trim() };
  }

  const raw = match[1];
  const metadata = {};

  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    metadata[key] = value;
  }

  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

  return { metadata, body };
}

function cleanText(text = "") {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}

function getSlugFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

async function processFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const { metadata, body } = parseFrontmatter(raw);

  const slug = getSlugFromFile(filePath);
  const title = metadata.title || slug;
  const url = metadata.url || "";
  const section = metadata.section || "General";
  const keywords = metadata.keywords || "";

  const cleanedBody = cleanText(body);

  // Add metadata into the embedded text so retrieval is better
  const fullText = cleanText(`
Title: ${title}
URL: ${url}
Keywords: ${keywords}

${cleanedBody}
  `);

  const chunks = chunkText(fullText);

  const records = [];

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await getEmbedding(content);

    records.push({
      slug,
      chunk_index: i,
      title,
      section,
      url,
      content,
      embedding,
    });
  }

  return records;
}

async function deleteExistingSlug(slug) {
  const { error } = await supabase.from(TABLE_NAME).delete().eq("slug", slug);

  if (error) {
    throw new Error(`Failed deleting existing rows for ${slug}: ${error.message}`);
  }
}

async function insertRecords(records) {
  if (!records.length) return;

  const { error } = await supabase.from(TABLE_NAME).insert(records);

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }
}

async function main() {
  console.log(`Reading markdown files from: ${KNOWLEDGE_DIR}`);

  const files = await fg("**/*.md", { cwd: KNOWLEDGE_DIR, absolute: true });

  if (!files.length) {
    console.log("No markdown files found.");
    return;
  }

  console.log(`Found ${files.length} markdown files.`);

  for (const file of files) {
    const slug = getSlugFromFile(file);
    console.log(`\nProcessing ${slug}...`);

    const records = await processFile(file);

    console.log(`Deleting old rows for ${slug}...`);
    await deleteExistingSlug(slug);

    console.log(`Inserting ${records.length} chunks for ${slug}...`);
    await insertRecords(records);

    console.log(`Done: ${slug}`);
  }

  console.log("\nKnowledge base sync complete.");
}

main().catch((err) => {
  console.error("Sync failed:");
  console.error(err);
  process.exit(1);
});