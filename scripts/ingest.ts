/**
 * Document ingestion for the regulatory knowledge base.
 *
 * Walks data/knowledge_base/ for local PDF/text/Markdown documents, splits
 * them into chunks, embeds them via OpenRouter, and upserts them into the
 * Supabase pgvector store (replacing whatever was indexed before). Drop
 * real Maine DMR application forms, statutes, and guidance documents into
 * data/knowledge_base/ and run:
 *
 *   npx tsx scripts/ingest.ts
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Must be the first import: it populates process.env from .env.local before
// the Supabase and OpenRouter clients below are constructed at import time.
import "./load-env";

import { embedMany } from "ai";
import { PDFParse } from "pdf-parse";

import { embeddingModel } from "@/lib/openrouter";
import { chunkText } from "@/lib/rag/chunk";
import { supabase } from "@/lib/supabase";

const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), "data", "knowledge_base");

/**
 * Bookkeeping files that live in data/knowledge_base/ but are not regulatory
 * source material. Without this, SOURCES.md gets chunked and indexed, and the
 * assistant can end up citing our own notes as if they were DMR guidance.
 */
const NOT_SOURCE_MATERIAL = new Set(["sources.md", "readme.md"]);

interface LoadedDocument {
  source: string;
  text: string;
}

async function loadPdf(filePath: string, source: string): Promise<LoadedDocument> {
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return { source, text: result.text };
}

async function loadText(filePath: string, source: string): Promise<LoadedDocument> {
  return { source, text: await readFile(filePath, "utf-8") };
}

async function loadDocuments(dir: string): Promise<LoadedDocument[]> {
  let entries: string[];
  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    console.warn(`Knowledge base directory not found: ${dir}`);
    return [];
  }

  const documents: LoadedDocument[] = [];
  for (const entry of entries) {
    const filePath = path.join(dir, entry);
    const ext = path.extname(entry).toLowerCase();
    const source = entry;
    if (NOT_SOURCE_MATERIAL.has(path.basename(entry).toLowerCase())) continue;
    try {
      if (ext === ".pdf") documents.push(await loadPdf(filePath, source));
      else if (ext === ".txt" || ext === ".md") documents.push(await loadText(filePath, source));
    } catch (err) {
      console.error(`Failed to load ${filePath}:`, err);
    }
  }

  if (documents.length === 0) {
    console.warn(`No supported documents found in ${dir} — knowledge base is empty.`);
  }
  return documents;
}

async function main() {
  const documents = await loadDocuments(KNOWLEDGE_BASE_DIR);
  console.log(`Loaded ${documents.length} document(s).`);

  const chunks: { content: string; metadata: { source: string } }[] = [];
  for (const doc of documents) {
    for (const content of chunkText(doc.text)) {
      chunks.push({ content, metadata: { source: doc.source } });
    }
  }
  console.log(`Split into ${chunks.length} chunk(s).`);

  if (chunks.length === 0) {
    console.log("Nothing to index. Vector store left unchanged.");
    return;
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks.map((c) => c.content),
  });

  await supabase.from("document_chunks").delete().neq("id", -1);

  const rows = chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: embeddings[i],
  }));
  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw new Error(`Failed to insert chunks: ${error.message}`);

  console.log(`Indexed ${rows.length} chunk(s) into Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
