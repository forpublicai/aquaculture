/**
 * Retrieval-augmented Q&A over the DMR regulatory knowledge base
 * (Supabase pgvector). Fails safe: if nothing relevant is retrieved, it
 * says so rather than answering from the model's general knowledge, since
 * an ungrounded guess presented as regulatory fact is worse than no answer.
 */
import { embed, streamText, toUIMessageStream, type UIMessageStreamWriter } from "ai";

import { HOUSE_STYLE } from "@/lib/chat/style";
import { chatModel, embeddingModel } from "@/lib/openrouter";
import { describeSource } from "@/lib/rag/catalog";
import { supabase } from "@/lib/supabase";

export const EMPTY_KB_MESSAGE =
  "I don't have any regulatory documents loaded yet, so there's nothing for me to " +
  "answer that from. Add Maine DMR application forms, statutes, or guidance documents " +
  "and re-run ingestion, or check with DMR directly in the meantime.";

/**
 * Voice and format guidance is as load-bearing here as the grounding rules.
 *
 * Written against two real failures. First: asked to compare cultivation
 * methods, the model produced a ten-row table, three headings, and a closing
 * caveat longer than the answer. Second, after that was fixed: an answer that
 * was the right length but had an em dash in every bullet and one in the opening
 * sentence, which reads as machine output however correct it is.
 *
 * The `situation` slot tells the model where the applicant actually is. A
 * question asked during an interview is nearly always a request for help
 * answering *that question*, not for a survey of the topic, and the answer should
 * hand the conversation back at the end. That handoff used to be a separate
 * message appended after the stream; it's part of the answer now, because a
 * mechanical "Back to it" bolted onto a reply that already covered the ground
 * just reads as the app repeating itself.
 */
const RAG_INSTRUCTIONS = `You are helping someone apply for a Maine aquaculture \
license. Answer their question using ONLY the context documents below, never \
from your own knowledge of DMR rules, which may be out of date or wrong.

Where the applicant is right now: {situation}

${HOUSE_STYLE}

Shape of the answer:

- Lead with the direct answer in one or two sentences. They should be able to \
stop reading after the first line and have got the main thing.
- Then add only the detail that helps them act on it. Under 150 words unless \
the question genuinely needs more.
- Use a short bulleted list only when genuinely enumerating three or more \
parallel items. Keep each bullet to a line. Where a bullet needs a label and a \
description, separate them with a colon, not a dash.
- No headings and no markdown tables. This is a narrow chat column and both \
read badly in it.
- Leave out anything they didn't ask about, however interesting it is.

If the note above says they were in the middle of being asked something, finish \
with one short sentence that hands the conversation back to that question, \
phrased in your own words. Don't repeat the question word for word, don't add a \
divider, and don't do this if they weren't in the middle of anything.

Citing:

- Cite using the exact markdown link on the "cite as:" line of a context document.
- One citation at the end of the sentence it supports. Don't stack links \
together and don't repeat the same link through the answer.
- Never cite a bare filename, and never write a URL that isn't in the context.

If the context doesn't answer the question, say so in a sentence and point them \
to DMR. Don't pad it out with the parts you almost know, and never present a \
guess as a confirmed requirement.

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
  situation: string,
  writer: UIMessageStreamWriter
): Promise<{ sources: string[] }> {
  const chunks = await retrieve(question);
  if (chunks.length === 0) return { sources: [] };

  const result = streamText({
    model: chatModel,
    instructions: RAG_INSTRUCTIONS.replace("{situation}", situation).replace(
      "{context}",
      formatContext(chunks)
    ),
    prompt: question,
  });
  writer.merge(toUIMessageStream({ stream: result.fullStream }));

  const sources = [
    ...new Set(chunks.map((c) => describeSource(c.metadata.source).title)),
  ].sort();
  return { sources };
}
