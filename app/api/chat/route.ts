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

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const updated = await handleMessage(conversation, userText, writer);
      await saveConversation(updated);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
