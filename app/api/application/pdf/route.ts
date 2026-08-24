/**
 * Downloading the application as DMR's own form, filled in.
 *
 * Reads the form and its coordinate map (when one has been measured) off disk
 * rather than bundling them: both are static files in the repo, the PDFs run to
 * megabytes, and neither belongs in a JavaScript bundle.
 *
 * The forms live in data/forms/, not data/knowledge_base/. The knowledge base
 * is corpus: it is gitignored and refetched by script, so on a fresh clone or
 * on Vercel it is empty, and this route would 500. It is also *allowed* to
 * change when DMR revises a form, which would silently put an overlay map out
 * of step with the document it was measured from. The copies the app draws on
 * are committed and pinned, beside the maps generated from them.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { fillForm, type OverlayMap } from "@/lib/application/pdf";
import { definitionForApplication } from "@/lib/application/registry";
import { loadConversation } from "@/lib/chat/session";
import { getUserId } from "@/lib/chat/user";

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

  const definition = definitionForApplication(conversation.application);
  if (!definition.pdf) {
    return Response.json(
      { error: "This application can't be produced as a document yet." },
      { status: 404 }
    );
  }

  const form = await readFile(path.join(process.cwd(), "data", "forms", definition.pdf.formFile));
  const map = definition.pdf.mapFile
    ? ((JSON.parse(
        await readFile(path.join(process.cwd(), "data", definition.pdf.mapFile), "utf8")
      ) as OverlayMap))
    : null;

  const filled = await fillForm(definition, form, map, conversation.application);
  const base = definition.pdf.downloadName;
  const name = filled.draft ? `${base}-DRAFT.pdf` : `${base}.pdf`;

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
