/**
 * Retrieval-augmented Q&A over the DMR regulatory knowledge base
 * (Supabase pgvector). Fails safe: if nothing relevant is retrieved, it
 * says so rather than answering from the model's general knowledge, since
 * an ungrounded guess presented as regulatory fact is worse than no answer.
 */
import { embed, streamText, toUIMessageStream, type UIMessageStreamWriter } from "ai";

import { chatModel, embeddingModel } from "@/lib/openrouter";
import { describeSource } from "@/lib/rag/catalog";
import { supabase } from "@/lib/supabase";

export const EMPTY_KB_MESSAGE =
  "I don't have any regulatory documents loaded yet to answer that from — the " +
  "knowledge base is empty. Add Maine DMR application forms, statutes, or guidance " +
  "documents and re-run ingestion, or check with DMR directly in the meantime.";

const RAG_INSTRUCTIONS = `You are a regulatory Q&A assistant for Maine aquaculture \
license applicants. Answer the applicant's question using ONLY the context \
documents provided below — do not rely on outside knowledge of Maine DMR \
rules, since it may be outdated or wrong.

If the context doesn't contain enough information to answer confidently, say \
so plainly and suggest the applicant check with DMR directly. Never present \
a guess as a confirmed regulatory requirement.

When you do answer from the context, keep it concise and cite your sources \
using the exact markdown link given on the "cite as:" line of each context \
document — for example [DMR: LPA and Lease Requirements](https://www.maine.gov/...). \
Never cite a bare filename, and never write a URL that does not appear in the \
context below.

Context:
{context}`;

interface DocumentChunk {
  content: string;
  metadata: { source?: string; page?: number };
}

/**
 * `k` is deliberately generous: chunks are ~1000 characters, and comparison
 * questions ("LPA vs standard lease") need passages from several documents at
 * once. At k=4 a single wordy application form filled every slot and crowded
 * out the regulations. Ten chunks is still only ~10k characters of context.
 */
async function retrieve(question: string, k = 10): Promise<DocumentChunk[]> {
  const { embedding } = await embed({ model: embeddingModel, value: question });
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: k,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return (data ?? []) as DocumentChunk[];
}

function formatContext(chunks: DocumentChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const { title, url } = describeSource(chunk.metadata.source);
      const page = chunk.metadata.page;
      const label = `[${i + 1}] ${title}` + (page !== undefined ? ` (page ${page + 1})` : "");
      // Handing the model a ready-made markdown link is deliberate: it removes
      // any need for the model to reconstruct a URL, which is where citation
      // hallucination usually creeps in.
      const citation = url ? `[${title}](${url})` : title;
      return `${label}\ncite as: ${citation}\n\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Streams a grounded answer directly onto a UI message stream writer, so
 * the RAG path shares the same wire format as the triage path (see
 * lib/chat/respond.ts). Writes nothing further if the knowledge base is
 * empty — caller should check `sources.length` and fall back to
 * EMPTY_KB_MESSAGE via streamStaticText in that case.
 */
export async function answerQuestion(
  question: string,
  writer: UIMessageStreamWriter
): Promise<{ sources: string[] }> {
  const chunks = await retrieve(question);
  if (chunks.length === 0) return { sources: [] };

  const result = streamText({
    model: chatModel,
    instructions: RAG_INSTRUCTIONS.replace("{context}", formatContext(chunks)),
    prompt: question,
  });
  writer.merge(toUIMessageStream({ stream: result.fullStream }));

  const sources = [
    ...new Set(chunks.map((c) => describeSource(c.metadata.source).title)),
  ].sort();
  return { sources };
}
