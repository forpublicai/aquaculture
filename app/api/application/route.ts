/**
 * Correcting the draft application by hand.
 *
 * The rules about what may be written, and what a value has to look like, live
 * in `lib/application/lpa/edits.ts` so they can be read and tested on their own.
 * This file is only the HTTP around them: identify the browser, load the
 * conversation it owns, apply one edit, save.
 */
import { applyEdit, type ApplicationEdit } from "@/lib/application/lpa/edits";
import { loadConversation, saveConversation } from "@/lib/chat/session";
import { getUserId } from "@/lib/chat/user";

export async function PATCH(req: Request) {
  const userId = await getUserId();
  // No cookie means no conversations to own, so nothing to edit.
  if (!userId) return Response.json({ error: "No session" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    conversationId?: string;
    edit?: ApplicationEdit;
  } | null;

  const conversationId = body?.conversationId;
  const edit = body?.edit;
  if (!conversationId || !edit) {
    return Response.json({ error: "conversationId and edit are required" }, { status: 400 });
  }

  // Scoped by user id, so someone else's conversation id reaches nothing.
  const conversation = await loadConversation(userId, conversationId);
  if (!conversation?.application) {
    return Response.json({ error: "No application to edit" }, { status: 404 });
  }

  const result = applyEdit(conversation.application, edit);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });

  await saveConversation({ ...conversation, application: result.application });
  return Response.json({ application: result.application });
}
