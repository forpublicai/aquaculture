/**
 * Derives a short title for a conversation from its first user message, so the
 * chat list reads like "Oysters, suspended cages, Casco Bay" rather than a row
 * of identical "New conversation" entries.
 */
import { generateText } from "ai";

import { chatModel } from "@/lib/openrouter";

const INSTRUCTIONS = `Write a title of at most six words for an aquaculture \
licensing conversation that opened with the message below. Name the concrete \
details — species, gear, place — if they are present. Output the title alone: \
no quotation marks, no trailing punctuation, no preamble.`;

/** Truncates the message itself — used when the model call fails or is empty. */
function fallbackTitle(firstUserMessage: string): string {
  const flat = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!flat) return "New conversation";
  return flat.length > 48 ? `${flat.slice(0, 45)}...` : flat;
}

export async function generateTitle(firstUserMessage: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: chatModel,
      instructions: INSTRUCTIONS,
      prompt: firstUserMessage,
    });
    const title = text.replace(/["\n]/g, " ").replace(/\s+/g, " ").trim();
    return title ? title.slice(0, 60) : fallbackTitle(firstUserMessage);
  } catch {
    // A title is cosmetic — never fail a chat turn over one.
    return fallbackTitle(firstUserMessage);
  }
}
