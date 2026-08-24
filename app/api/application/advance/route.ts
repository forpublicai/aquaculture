/**
 * Advancing a conversation's application to its successor form.
 *
 * The one licensed use today is the Standard lease: a completed draft
 * application advances to the final application, carrying the shared answers
 * and stashing the draft. The rules live in lib/application/advance.ts; this
 * file is only the HTTP around them.
 *
 * Advancing is allowed even when the draft is incomplete — the applicant may
 * know their own process better than our checklist, and the draft is kept, so
 * nothing is lost — but the client is expected to confirm the intent, because
 * the interview's focus moves to the new form immediately.
 */
import { advanceApplication } from "@/lib/application/advance";
import { definitionForApplication, DEFINITIONS } from "@/lib/application/registry";
import { loadConversation, saveConversation } from "@/lib/chat/session";
import { getUserId } from "@/lib/chat/user";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "No session" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { conversationId?: string } | null;
  const conversationId = body?.conversationId;
  if (!conversationId) {
    return Response.json({ error: "conversationId is required" }, { status: 400 });
  }

  // Scoped by user id, so someone else's conversation id reaches nothing.
  const conversation = await loadConversation(userId, conversationId);
  if (!conversation?.application) {
    return Response.json({ error: "No application to advance" }, { status: 404 });
  }

  const from = definitionForApplication(conversation.application);
  const successor = from.successor ? DEFINITIONS[from.successor.id] : undefined;
  if (!successor) {
    return Response.json(
      { error: "This application has no further form to advance to." },
      { status: 400 }
    );
  }

  const application = advanceApplication(from, successor, conversation.application);
  await saveConversation({ ...conversation, application });
  return Response.json({ application });
}
