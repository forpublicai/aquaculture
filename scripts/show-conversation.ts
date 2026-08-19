/**
 * Prints what is actually stored against a conversation.
 *
 * The point is to settle "did that answer get recorded?" by looking, rather than
 * by reasoning about the interview. It shows every form field that holds a
 * value, every field the interview still considers outstanding, and the tail of
 * the transcript, so an answer visible in the chat but absent from the form is
 * obvious at a glance.
 *
 * Usage:
 *   npm run show                     the most recently updated conversation
 *   npm run show -- <conversation-id>
 */
import "./load-env";

import { fieldApplies, fieldHasContent, LPA_FIELDS } from "@/lib/application/lpa/fields";
import { migrateApplication } from "@/lib/application/lpa/normalize";
import { applicationProgress } from "@/lib/application/lpa/progress";
import { supabase } from "@/lib/supabase";

const requestedId = process.argv[2];

const query = supabase
  .from("conversations")
  .select("id, title, updated_at, profile, routing, application, messages")
  .order("updated_at", { ascending: false })
  .limit(1);

const { data, error } = requestedId ? await query.eq("id", requestedId) : await query;

if (error) {
  console.error("Could not read the conversation:", error.message);
  process.exit(1);
}

const row = data?.[0];
if (!row) {
  console.error(requestedId ? `No conversation with id ${requestedId}` : "No conversations stored.");
  process.exit(1);
}

console.log(`Conversation: ${row.title ?? "(untitled)"}`);
console.log(`Id:           ${row.id}`);
console.log(`Last saved:   ${row.updated_at}`);
console.log(`\nTriage profile: ${JSON.stringify(row.profile)}`);
console.log(`Routing:        ${JSON.stringify(row.routing)}`);

const application = migrateApplication(row.application);
if (!application) {
  console.log("\nNo application draft yet, so the conversation is still in triage.");
} else {
  const progress = applicationProgress(application);
  console.log(`\nApplication: ${progress.answered} of ${progress.applicable} answered\n`);

  console.log("Recorded:");
  const recorded = LPA_FIELDS.filter(
    (field) => fieldApplies(field, application) && fieldHasContent(field, application)
  );
  if (recorded.length === 0) console.log("  (nothing)");
  for (const field of recorded) {
    console.log(`  ${field.label} [${field.key}] = ${JSON.stringify(application[field.key])}`);
  }

  console.log("\nStill outstanding:");
  const outstanding = progress.missing.map((field) => `${field.label} [${field.key}]`);
  console.log(outstanding.length === 0 ? "  (none)" : `  ${outstanding.join("\n  ")}`);

  if (application.pendingConcern) {
    console.log(`\nOutstanding query about: ${application.pendingConcern}`);
  }
}

const messages = Array.isArray(row.messages) ? row.messages : [];
console.log(`\nLast turns of the transcript (${messages.length} messages total):\n`);
for (const message of messages.slice(-8)) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const text = parts
    .filter((part: { type?: string }) => part?.type === "text")
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
  console.log(`[${message?.role}] ${text}\n`);
}
