import { loadConversation } from "@/lib/chat/session";
import { getUserId } from "@/lib/chat/user";

const EMPTY = { profile: null, routing: null, messages: [], title: null, application: null };

/**
 * Returns one conversation's profile + routing + draft application (for the
 * sidebar), saved chat
 * transcript, and title. Responds with empties rather than an error when the
 * conversation is missing or belongs to another browser — the client treats
 * both the same way, and distinguishing them would leak whether an id exists.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const userId = await getUserId();
  if (!id || !userId) return Response.json(EMPTY);

  const conversation = await loadConversation(userId, id);
  if (!conversation) return Response.json(EMPTY);

  return Response.json({
    profile: conversation.profile,
    routing: conversation.routing,
    messages: conversation.messages,
    title: conversation.title,
    application: conversation.application,
  });
}
