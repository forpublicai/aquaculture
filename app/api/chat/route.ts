import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";

import { writeStaticText } from "@/lib/chat/respond";
import { handleMessage, loadConversation, saveConversation } from "@/lib/chat/session";
import { generateTitle } from "@/lib/chat/title";
import { getOrCreateUserId } from "@/lib/chat/user";

/**
 * What the applicant sees when a turn fails.
 *
 * Everything the applicant reads is read by strangers. No names, no internal
 * detail, nothing about who built this or how it works: the reason belongs in
 * the server log, which is where it goes. Say what happened, say what to do, and
 * stop.
 */
const TURN_FAILED =
  "Something went wrong at my end and I didn't manage to record that, so please " +
  "send it again. If it keeps happening on the same answer, try putting it a " +
  "different way.";

/**
 * Records a failed turn to `debug-errors.log`, alongside the extraction log.
 *
 * A stack trace in a terminal is gone the moment the terminal scrolls, and it
 * can only be read by whoever is sitting in front of it. Written to a file it
 * can be read after the fact, which is the same reason `DEBUG_EXTRACTION` writes
 * a file rather than logging to the console.
 *
 * Gated on the same flag, so nothing tries to write to disk where it can't, and
 * wrapped in its own try: a logger that throws inside a catch block would turn a
 * recoverable turn into a broken one.
 */
async function recordFailure(userText: string, error: unknown) {
  console.error("[chat] turn failed, nothing was recorded:", error);
  if (!process.env.DEBUG_EXTRACTION) return;
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      "debug-errors.log",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          userMessage: userText,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          // Model-call failures carry the offending output on the error itself,
          // which is the part worth having and the part a stack trace omits.
          cause: error instanceof Error && error.cause ? String(error.cause) : undefined,
          text: (error as { text?: string })?.text,
          value: (error as { value?: unknown })?.value,
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2
      ) + "\n\n"
    );
    console.error("[chat] wrote the reason to debug-errors.log");
  } catch {
    // Logging must never be the thing that breaks a turn.
  }
}

function latestUserText(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request) {
  const { messages, conversationId } = (await req.json()) as {
    messages: UIMessage[];
    conversationId?: string;
  };

  if (!conversationId) {
    return new Response("conversationId is required", { status: 400 });
  }

  const userId = await getOrCreateUserId();
  const conversation = await loadConversation(userId, conversationId);
  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const userText = latestUserText(messages);

  // Holds the state this turn produced, so the onEnd callback can save it
  // alongside the transcript in a single write.
  let updated = conversation;

  const stream = createUIMessageStream({
    // Passing the client's messages puts the stream in "persistence mode":
    // onEnd then receives the complete transcript (this user turn plus the
    // assistant reply we just streamed), which is what we store.
    originalMessages: messages,
    execute: async ({ writer }) => {
      try {
        updated = await handleMessage(conversation, userText, writer);
      } catch (error) {
        // A turn can fail part-way: extraction is a model call against a strict
        // schema, and a model that returns "43.79" where the form wants a number
        // makes `generateObject` throw. Without this the failure was silent and
        // expensive. `updated` still holds the state the turn began from, which
        // is correct, but `onEnd` would save it anyway, so the applicant's answer
        // would sit in the transcript with nothing recorded on the form and the
        // interview would ask the same question again as though they had never
        // spoken.
        //
        // Nothing is repaired here. The point is only that a lost turn says so.
        await recordFailure(userText, error);
        writeStaticText(writer, TURN_FAILED);
      }
    },
    // Without this the SDK swallows the reason and the browser is told only
    // that "an error occurred", which is no use when the interesting part is
    // which field the model failed to produce.
    onError: (error) => {
      void recordFailure(userText, error);
      return TURN_FAILED;
    },
    onEnd: async ({ messages: transcript }) => {
      // Title the conversation from its opening message, once.
      const title = updated.title ?? (userText ? await generateTitle(userText) : null);
      await saveConversation({ ...updated, title, messages: transcript });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
