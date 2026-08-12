/**
 * Streams an already-known string (e.g. a deterministic routing
 * recommendation) through the same UIMessageStream wire format useChat
 * expects from an LLM response, so the triage path and the RAG path look
 * identical to the client. Used specifically because the routing
 * recommendation text is intentionally rule-based, not model-generated —
 * see lib/routing/rules.ts — so it must not be re-synthesized by the model.
 */
import type { UIMessageStreamWriter } from "ai";

export function writeStaticText(writer: UIMessageStreamWriter, text: string, id = "static-0") {
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}
