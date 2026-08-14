/**
 * Inspects the regulatory knowledge base in Supabase.
 *
 * Prints how many chunks are indexed per source document, then — if you pass a
 * question — runs the exact same retrieval the chat app uses and shows what
 * comes back, so you can tell whether a disappointing answer is a retrieval
 * problem (wrong chunks came back) or a content problem (right chunks, but the
 * source material doesn't actually say what you hoped).
 *
 * Usage:
 *   npm run kb:status
 *   npm run kb:status -- "what is the difference between an LPA and a standard lease?"
 */
import "./load-env";

import { embed } from "ai";

import { embeddingModel } from "@/lib/openrouter";
import { supabase } from "@/lib/supabase";

const PAGE = 1000;

async function listSources(): Promise<number> {
  const counts = new Map<string, number>();
  let total = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("metadata")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const source = (row.metadata as { source?: string })?.source ?? "(no source recorded)";
      counts.set(source, (counts.get(source) ?? 0) + 1);
      total += 1;
    }
    if (data.length < PAGE) break;
  }

  if (total === 0) {
    console.log("Knowledge base is EMPTY — no chunks indexed.");
    console.log("Run: bash scripts/fetch-knowledge-base.sh && npm run ingest");
    return 0;
  }

  console.log(`Indexed documents (${counts.size} source(s), ${total} chunks total):\n`);
  const width = Math.max(...[...counts.keys()].map((s) => s.length));
  for (const [source, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(width)}  ${String(n).padStart(5)} chunks`);
  }
  return total;
}

async function probe(question: string, k: number): Promise<void> {
  console.log(`\n\nRetrieval probe — top ${k} chunks for:\n  "${question}"\n`);

  const { embedding } = await embed({ model: embeddingModel, value: question });
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: k,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);

  const rows = (data ?? []) as {
    content: string;
    metadata: { source?: string };
    similarity: number;
  }[];

  if (rows.length === 0) {
    console.log("  Nothing retrieved.");
    return;
  }

  rows.forEach((row, i) => {
    const preview = row.content.replace(/\s+/g, " ").trim().slice(0, 220);
    console.log(`[${i + 1}] similarity ${row.similarity.toFixed(3)}  ${row.metadata?.source ?? "?"}`);
    console.log(`    ${preview}...\n`);
  });

  console.log(
    "The chat app retrieves only the top 4 (see `retrieve` in lib/rag/qa.ts).\n" +
      "If the useful passages above rank below #4, raising that number fixes it."
  );
}

async function main(): Promise<void> {
  const total = await listSources();
  const question = process.argv.slice(2).join(" ").trim();
  if (total > 0 && question) await probe(question, 10);
  else if (total > 0) console.log("\nTip: pass a question to see what retrieval returns for it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
