import { cookies } from "next/headers";

import { loadConversation } from "@/lib/chat/session";

const SESSION_COOKIE = "aquaculture_session";

/** Returns the current session's application profile + routing recommendation, for the sidebar. */
export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return Response.json({ profile: null, routing: null });
  }
  const conversation = await loadConversation(sessionId);
  return Response.json({ profile: conversation.profile, routing: conversation.routing });
}
