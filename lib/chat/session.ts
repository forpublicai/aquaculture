/**
 * Conversation storage and per-turn routing.
 *
 * A browser owns many conversations (see lib/chat/user.ts for the anonymous
 * identity). Each row in `conversations` is one chat: its transcript, the
 * application profile extracted so far, and the routing recommendation. Every
 * read and write is scoped by user id, so a conversation id alone is not
 * enough to reach someone else's chat.
 *
 * Each message is classified and routed to one of three places: regulatory Q&A,
 * the license-triage interview, or — once triage has settled on a license type —
 * the application intake interview that fills that license's form in.
 */
import { randomUUID } from "node:crypto";

import type { UIMessage, UIMessageStreamWriter } from "ai";

import {
  formatIntakeIntro,
  pendingQuestionText,
  runApplicationTurn,
  seedApplication,
} from "@/lib/application/lpa/interview";
import { answerRecall } from "@/lib/application/lpa/recall";
import type { LpaApplication } from "@/lib/application/lpa/schema";
import { classifyIntent } from "@/lib/chat/intent";
import { writeStaticText } from "@/lib/chat/respond";
import { answerQuestion, EMPTY_KB_MESSAGE } from "@/lib/rag/qa";
import { UNDETERMINED_ROUTING } from "@/lib/routing/rules";
import { nextQuestion, runInterviewTurn } from "@/lib/routing/interview";
import {
  EMPTY_PROFILE,
  LicenseType,
  type OperationProfile,
  type RoutingResult,
} from "@/lib/routing/schema";
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
  /**
   * The draft license application. Null until triage recommends a license type
   * we can collect a form for (currently LPA only), which is what marks the
   * conversation as having moved from triage into intake.
   */
  application: LpaApplication | null;
}

/** A row in the chat list, holding everything the sidebar needs and nothing more. */
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
    application: null,
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
    .select("id, user_id, title, profile, routing, messages, application")
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
    application: (data.application as LpaApplication | null) ?? null,
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
    application: state.application,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to save conversation: ${error.message}`);
}

/** The question the applicant still owes us an answer to, if any. */
function pendingQuestion(state: ConversationState): string | null {
  if (state.application) return pendingQuestionText(state.application);
  const question = nextQuestion(state.profile);
  return question === "" ? null : question;
}

/**
 * Tells the Q&A model where the applicant is standing. A question asked in the
 * middle of an interview is nearly always a request for help answering *that
 * question*. Someone asking "what's the difference between cultivation
 * methods?" right after being asked which gear they'll use wants to know which
 * box to tick, not a survey of every license type's gear taxonomy.
 */
function describeSituation(state: ConversationState): string {
  const pending = pendingQuestion(state);

  if (state.application) {
    return (
      "Partway through filling in the LPA license application" +
      (pending ? `, having just been asked: "${pending}"` : "") +
      ". Answer in whatever way best helps them with that. They have already been " +
      "told an LPA is the right license, so don't cover experimental or standard " +
      "leases unless they explicitly ask to compare."
    );
  }

  if (state.routing.licenseType !== LicenseType.UNDETERMINED) {
    return (
      `They've been told a ${state.routing.licenseType} looks like the right fit, but ` +
      "haven't started that application yet. Focus on that license type."
    );
  }

  return (
    "Still working out which license type they need" +
    (pending ? `, having just been asked: "${pending}"` : "") +
    ". Help them answer that. Compare license types only if they asked a " +
    "comparative question."
  );
}

/**
 * Reply to a greeting or an aside. If there's a question outstanding it just
 * asks it again, rather than prefixing it with a cheerful acknowledgement that
 * adds nothing and reads like a bot.
 */
function otherReply(state: ConversationState): string {
  return (
    pendingQuestion(state) ??
    "Ask me anything about Maine DMR aquaculture regulations, or tell me if " +
      "something about your operation has changed."
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
    const { sources } = await answerQuestion(userMessage, describeSituation(state), writer);
    if (sources.length === 0) {
      writeStaticText(writer, EMPTY_KB_MESSAGE);
    }
    // The answer itself hands the conversation back to whatever question was
    // outstanding (see the Q&A instructions). Appending a second message here
    // to do that job wrote it *before* the streamed answer, since writer.merge
    // returns as soon as the merge is set up rather than when it finishes.
    return state;
  }

  // Asking what the app already holds is neither a regulatory question nor an
  // answer, so before this it fell through to extraction, found nothing, and got
  // apologized at.
  if (intent === "application_recall" && state.application) {
    await answerRecall(state.application, userMessage, writer);
    return state;
  }

  // Once an application draft exists the conversation's job has changed from
  // "which license?" to "let's fill this one in", so everything that isn't a
  // regulatory question is treated as an answer to the question we just asked.
  // A greeting or an aside extracts nothing and simply gets the question again.
  if (state.application) {
    const { application, reply } = await runApplicationTurn(
      state.application,
      userMessage,
      state.profile
    );
    writeStaticText(writer, reply);
    return { ...state, application };
  }

  if (intent === "other") {
    writeStaticText(writer, otherReply(state));
    return state;
  }

  const { profile, routing, reply } = await runInterviewTurn(state.profile, userMessage);

  // Triage has just landed on an LPA: open the application and roll straight
  // into the first intake question rather than making the applicant ask.
  if (routing.licenseType === LicenseType.LIMITED_PURPOSE_AQUACULTURE) {
    const application = seedApplication(profile);
    writeStaticText(writer, `${reply}\n\n---\n\n${formatIntakeIntro(application)}`);
    return { ...state, profile, routing, application };
  }

  writeStaticText(writer, reply);
  return { ...state, profile, routing };
}
