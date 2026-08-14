/**
 * Conversation storage and per-turn routing.
 *
 * A browser owns many conversations (see lib/chat/user.ts for the anonymous
 * identity). Each row in `conversations` is one chat: its transcript, the
 * application profile extracted so far, and the routing recommendation. Every
 * read and write is scoped by user id, so a conversation id alone is not
 * enough to reach someone else's chat.
 *
 * Each message is classified and routed to either the license-triage interview
 * or regulatory Q&A.
 */
import { randomUUID } from "node:crypto";

import type { UIMessage, UIMessageStreamWriter } from "ai";

import { classifyIntent } from "@/lib/chat/intent";
import { writeStaticText } from "@/lib/chat/respond";
import { answerQuestion, EMPTY_KB_MESSAGE } from "@/lib/rag/qa";
import { UNDETERMINED_ROUTING } from "@/lib/routing/rules";
import { nextQuestion, runInterviewTurn } from "@/lib/routing/interview";
import { EMPTY_PROFILE, type OperationProfile, type RoutingResult } from "@/lib/routing/schema";
import { supabase } from "@/lib/supabase";

export const UNTITLED = "New conversation";

export interface ConversationState {
  id: string;
  userId: string;
  /** Null until the first user message arrives and a title is derived from it. */
  title: string | null;
  profile: OperationProfile;
  routing: RoutingResult;
  /** Full chat transcript, in the wire format useChat renders directly. */
  messages: UIMessage[];
}

/** A row in the chat list — everything the sidebar needs, nothing more. */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? UNTITLED,
    updatedAt: row.updated_at as string,
  }));
}

export async function createConversation(userId: string): Promise<ConversationSummary> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("conversations").insert({
    id,
    user_id: userId,
    title: null,
    profile: EMPTY_PROFILE,
    routing: UNDETERMINED_ROUTING,
    messages: [],
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Failed to create conversation: ${error.message}`);

  return { id, title: UNTITLED, updatedAt: now };
}

/**
 * Deletes a conversation. Scoped by user id, so a request carrying someone
 * else's conversation id deletes nothing rather than erasing their chat.
 */
export async function deleteConversation(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}

/** Returns null when the conversation doesn't exist or belongs to someone else. */
export async function loadConversation(
  userId: string,
  id: string
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, profile, routing, messages")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id as string,
    userId: data.user_id as string,
    title: (data.title as string | null) ?? null,
    profile: (data.profile as OperationProfile) ?? EMPTY_PROFILE,
    routing: (data.routing as RoutingResult) ?? UNDETERMINED_ROUTING,
    messages: (data.messages as UIMessage[] | null) ?? [],
  };
}

export async function saveConversation(state: ConversationState): Promise<void> {
  const { error } = await supabase.from("conversations").upsert({
    id: state.id,
    user_id: state.userId,
    title: state.title,
    profile: state.profile,
    routing: state.routing,
    messages: state.messages,
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
