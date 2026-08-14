import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";

import { handleMessage, loadConversation, saveConversation } from "@/lib/chat/session";
import { generateTitle } from "@/lib/chat/title";
import { getOrCreateUserId } from "@/lib/chat/user";

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
      updated = await handleMessage(conversation, userText, writer);
    },
    onEnd: async ({ messages: transcript }) => {
      // Title the conversation from its opening message, once.
      const title = updated.title ?? (userText ? await generateTitle(userText) : null);
      await saveConversation({ ...updated, title, messages: transcript });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
