/**
 * Downloading the application as DMR's own form, filled in.
 *
 * Reads the form and the coordinate map off disk rather than bundling them: both
 * are static files in the repo, the PDF is two megabytes, and neither belongs in
 * a JavaScript bundle.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { fillLpaForm, type OverlayMap } from "@/lib/application/lpa/overlay";
import { loadConversation } from "@/lib/chat/session";
import { getUserId } from "@/lib/chat/user";

// data/forms/, not data/knowledge_base/. The knowledge base is corpus: it is
// gitignored and refetched by script, so on a fresh clone or on Vercel it is
// empty, and this route would 500. It is also *allowed* to change when DMR
// revises the form, which would silently put the overlay map out of step with
// the document it was measured from. The copy the app draws on is committed and
// pinned, and lives beside the map generated from it.
const FORM = path.join(process.cwd(), "data", "forms", "LPA_Application.pdf");
const MAP = path.join(process.cwd(), "data", "lpa-overlay-map.json");

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "No session" }, { status: 401 });

  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) {
    return Response.json({ error: "conversationId is required" }, { status: 400 });
  }

  // Scoped by user id, so someone else's conversation id reaches nothing.
  const conversation = await loadConversation(userId, conversationId);
  if (!conversation?.application) {
    return Response.json({ error: "No application to download" }, { status: 404 });
  }

  const [form, map] = await Promise.all([
    readFile(FORM),
    readFile(MAP, "utf8").then((text) => JSON.parse(text) as OverlayMap),
  ]);

  const filled = await fillLpaForm(form, map, conversation.application);
  const name = filled.draft ? "LPA-application-DRAFT.pdf" : "LPA-application.pdf";

  return new Response(filled.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      // So the review screen can say what happened without parsing the PDF.
      "X-Continuation-Sheets": String(filled.continued.length),
      "X-Draft": String(filled.draft),
    },
  });
}
