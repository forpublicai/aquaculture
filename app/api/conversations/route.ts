/**
 * The chat list: list, create, and delete this browser's conversations.
 *
 * (Singular /api/conversation returns the contents of one conversation.)
 */
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/chat/session";
import { getOrCreateUserId, getUserId } from "@/lib/chat/user";

export async function GET() {
  const userId = await getOrCreateUserId();
  return Response.json({ conversations: await listConversations(userId) });
}

export async function POST() {
  const userId = await getOrCreateUserId();
  return Response.json({ conversation: await createConversation(userId) });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id is required", { status: 400 });

  const userId = await getUserId();
  // No cookie means no conversations to own, so nothing to delete.
  if (!userId) return new Response("No session", { status: 401 });

  await deleteConversation(userId, id);
  return new Response(null, { status: 204 });
}
