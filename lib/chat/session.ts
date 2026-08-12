/**
 * Unified chat session: loads/saves conversation state from Supabase (so an
 * applicant can leave and resume), and routes each message to the
 * license-triage interview or regulatory Q&A based on intent.
 */
import type { UIMessageStreamWriter } from "ai";

import { classifyIntent } from "@/lib/chat/intent";
import { writeStaticText } from "@/lib/chat/respond";
import { answerQuestion, EMPTY_KB_MESSAGE } from "@/lib/rag/qa";
import { UNDETERMINED_ROUTING } from "@/lib/routing/rules";
import { nextQuestion, runInterviewTurn } from "@/lib/routing/interview";
import { EMPTY_PROFILE, type OperationProfile, type RoutingResult } from "@/lib/routing/schema";
import { supabase } from "@/lib/supabase";

export interface ConversationState {
  id: string;
  profile: OperationProfile;
  routing: RoutingResult;
}

export async function loadConversation(sessionId: string): Promise<ConversationState> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, profile, routing")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  if (!data) {
    return { id: sessionId, profile: EMPTY_PROFILE, routing: UNDETERMINED_ROUTING };
  }
  return data as ConversationState;
}

export async function saveConversation(state: ConversationState): Promise<void> {
  const { error } = await supabase.from("conversations").upsert({
    id: state.id,
    profile: state.profile,
    routing: state.routing,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to save conversation: ${error.message}`);
}

function otherReply(state: ConversationState): string {
  if (state.routing.missingFields.length > 0) {
    return `Happy to help! ${nextQuestion(state.profile)}`;
  }
  return (
    "Happy to help! Ask me anything about Maine DMR aquaculture regulations, " +
    "or let me know if anything about your operation has changed."
  );
}

/**
 * Processes one user message against `state`: classifies intent, routes to
 * RAG or the triage interview, and streams the reply onto `writer`. Returns
 * the (possibly updated) state — caller is responsible for persisting it.
 */
export async function handleMessage(
  state: ConversationState,
  userMessage: string,
  writer: UIMessageStreamWriter
): Promise<ConversationState> {
  const intent = await classifyIntent(userMessage);

  if (intent === "regulatory_question") {
    const { sources } = await answerQuestion(userMessage, writer);
    if (sources.length === 0) {
      writeStaticText(writer, EMPTY_KB_MESSAGE);
    }
    return state;
  }

  if (intent === "other") {
    writeStaticText(writer, otherReply(state));
    return state;
  }

  const { profile, routing, reply } = await runInterviewTurn(state.profile, userMessage);
  writeStaticText(writer, reply);
  return { ...state, profile, routing };
}
