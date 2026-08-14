import { randomUUID } from "node:crypto";

import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { cookies } from "next/headers";

import { handleMessage, loadConversation, saveConversation } from "@/lib/chat/session";

const SESSION_COOKIE = "aquaculture_session";

function latestUserText(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const conversation = await loadConversation(sessionId);
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
      await saveConversation({ ...updated, messages: transcript });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
