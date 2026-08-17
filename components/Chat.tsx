"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
// Without remark-gfm, react-markdown renders a markdown table as literal pipe
// characters — which is exactly how a comparison answer reached the browser
// before this was added. Tables are discouraged in the Q&A prompt now, but when
// one does come through it has to render as a table.
import remarkGfm from "remark-gfm";

import { Logo } from "@/design-system/components/brand/Logo";
import { Button } from "@/design-system/components/buttons/Button";
import { applicationProgress, validateApplication } from "@/lib/application/lpa/progress";
import { outstandingRequirements } from "@/lib/application/lpa/requirements";
import type { LpaApplication } from "@/lib/application/lpa/schema";
import type { ConversationSummary } from "@/lib/chat/session";
import { LicenseType, type OperationProfile, type RoutingResult } from "@/lib/routing/schema";

const GREETING =
  "Hi! I can help you figure out which aquaculture license you need and answer " +
  "questions about Maine DMR regulations. What are you looking to do?";

const FIELD_LABELS: { key: keyof OperationProfile; label: string }[] = [
  { key: "species", label: "Species" },
  { key: "gearType", label: "Gear / method" },
  { key: "siteAreaSqFt", label: "Site area (sq ft)" },
  { key: "leaseDurationYears", label: "Lease duration (years)" },
];

const HAIRLINE = "var(--border-hairline)";
const MUTED = "var(--pai-gray-800)";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: "var(--type-section-size)",
        fontWeight: "var(--type-section-weight)" as unknown as number,
      }}
    >
      {children}
    </h2>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  // Deleting is confirmed inline rather than with a browser dialog: the row
  // itself turns into "Delete? / Cancel", so nothing is destroyed on one click
  // and nothing blocks the page.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading>Conversations</SectionHeading>
        <button
          onClick={onCreate}
          className="rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: HAIRLINE }}
          title="Start a new conversation"
        >
          + New
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>
          No conversations yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeId;
            const isPending = pendingDelete === conversation.id;

            return (
              <li key={conversation.id}>
                {isPending ? (
                  <div
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs"
                    style={{ background: "var(--surface-subtle)" }}
                  >
                    <span>Delete this chat?</span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        onClick={() => {
                          setPendingDelete(null);
                          onDelete(conversation.id);
                        }}
                        className="underline"
                      >
                        Delete
                      </button>
                      <button onClick={() => setPendingDelete(null)} style={{ color: MUTED }}>
                        Cancel
                      </button>
                    </span>
                  </div>
                ) : (
                  <div
                    className="group flex items-center justify-between gap-1 rounded px-2 py-1.5"
                    style={{ background: isActive ? "var(--surface-subtle)" : undefined }}
                  >
                    <button
                      onClick={() => onSelect(conversation.id)}
                      className="flex-1 truncate text-left text-sm"
                      style={{ fontWeight: isActive ? 600 : 400 }}
                      title={conversation.title}
                    >
                      {conversation.title}
                    </button>
                    <button
                      onClick={() => setPendingDelete(conversation.id)}
                      className="shrink-0 px-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      style={{ color: MUTED }}
                      aria-label={`Delete ${conversation.title}`}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProfilePanel({
  profile,
  routing,
}: {
  profile: OperationProfile | null;
  routing: RoutingResult | null;
}) {
  return (
    <div>
      <SectionHeading>Application profile</SectionHeading>
      <dl className="space-y-3 text-sm">
        {FIELD_LABELS.map(({ key, label }) => {
          const value = profile?.[key];
          const display = Array.isArray(value) ? value.join(", ") : value;
          return (
            <div key={key}>
              <dt className="font-semibold">{label}</dt>
              <dd className="italic" style={{ color: MUTED }}>
                {display ? display : "not yet provided"}
              </dd>
            </div>
          );
        })}
      </dl>
      <hr className="my-5" style={{ borderColor: HAIRLINE }} />
      {/*
        Compared against the constant rather than a copy of its text. The old
        literal here had to be kept character-identical to the enum value, which
        is a silent breakage waiting to happen. (The value itself keeps its em
        dash: it is never rendered, and changing it would strand the license
        type stored on existing conversations.)
      */}
      {routing && routing.licenseType !== LicenseType.UNDETERMINED ? (
        <div
          className="rounded p-3 text-sm font-semibold"
          style={{ background: "var(--surface-subtle)", color: "var(--pai-black)" }}
        >
          Recommended: {routing.licenseType}
        </div>
      ) : (
        <div className="text-sm" style={{ color: MUTED }}>
          Still gathering details to recommend a license type.
        </div>
      )}
    </div>
  );
}

/**
 * Progress through the license application, once triage has opened one.
 *
 * Deliberately shows three different kinds of "not done": questions still to
 * answer, documents and signatures the app can't produce, and answers that look
 * wrong. Collapsing them into a single percentage would hide the ones that
 * actually block a submission — the form denies incomplete applications and
 * keeps the fee, so "90% done" is a misleading thing to tell someone.
 */
function ApplicationPanel({ application }: { application: LpaApplication }) {
  const progress = applicationProgress(application);
  const outstanding = outstandingRequirements(application);
  const issues = validateApplication(application);

  return (
    <div>
      <SectionHeading>LPA application</SectionHeading>

      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          {progress.answered} of {progress.applicable} answered
        </span>
        <span style={{ color: MUTED }}>{progress.percent}%</span>
      </div>
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-subtle)" }}
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress.percent}%`, background: "var(--pai-black)" }}
        />
      </div>

      <ul className="mb-4 space-y-1 text-xs">
        {progress.sections.map((section) => (
          <li key={section.id} className="flex items-center justify-between gap-2">
            <span style={{ color: section.complete ? undefined : MUTED }}>
              {/* Fixed-width slot so titles line up whether or not there's a tick. */}
              <span aria-hidden className="mr-1 inline-block w-3">
                {section.complete ? "✓" : ""}
              </span>
              {section.title}
            </span>
            <span className="shrink-0 tabular-nums" style={{ color: MUTED }}>
              {section.answered}/{section.applicable}
            </span>
          </li>
        ))}
      </ul>

      {issues.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold">Check these</p>
          {issues.map((issue, i) => (
            <p key={i} className="text-xs" style={{ color: MUTED }}>
              {issue.severity === "blocking" ? "🛑" : "⚠️"} {issue.message}
            </p>
          ))}
        </div>
      )}

      {outstanding.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold">
            Still needed from you ({outstanding.length})
          </p>
          {/*
            The bullet comes from list-disc, not from a character in the markup.
            This previously held a backslash-u escape for a middot, which JSX
            text nodes don't interpret, so it rendered as the raw escape text.
          */}
          <ul className="list-disc space-y-1 pl-4 text-xs" style={{ color: MUTED }}>
            {outstanding.map((req) => (
              <li key={req.id} title={req.detail}>
                {req.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Chat() {
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profile, setProfile] = useState<OperationProfile | null>(null);
  const [routing, setRouting] = useState<RoutingResult | null>(null);
  const [application, setApplication] = useState<LpaApplication | null>(null);

  const { messages, sendMessage, setMessages, regenerate, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      refreshActiveConversation();
      refreshList();
    },
  });

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, []);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeId) return;
    const res = await fetch(`/api/conversation?id=${encodeURIComponent(activeId)}`);
    const data = await res.json();
    setProfile(data.profile);
    setRouting(data.routing);
    setApplication(data.application ?? null);
  }, [activeId]);

  // Bootstrap: load the chat list, creating a first conversation if this
  // browser has none. The ref guard keeps this to one run under React's
  // development double-render.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      const existing: ConversationSummary[] = data.conversations ?? [];

      if (existing.length > 0) {
        setConversations(existing);
        setActiveId(existing[0].id);
        return;
      }

      const created = await fetch("/api/conversations", { method: "POST" });
      const { conversation } = await created.json();
      setConversations([conversation]);
      setActiveId(conversation.id);
    })();
  }, []);

  // Whenever the active conversation changes, swap in its transcript and
  // profile. Switching to a brand-new chat clears the message list.
  useEffect(() => {
    if (!activeId) return;
    let canceled = false;

    (async () => {
      const res = await fetch(`/api/conversation?id=${encodeURIComponent(activeId)}`);
      const data = await res.json();
      if (canceled) return;
      setProfile(data.profile);
      setRouting(data.routing);
      setApplication(data.application ?? null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    })();

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function handleCreate() {
    const res = await fetch("/api/conversations", { method: "POST" });
    const { conversation } = await res.json();
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);

    if (id !== activeId) return;
    // The open chat was the one deleted, so move somewhere valid — the next
    // conversation, or a fresh one if that was the last.
    if (remaining.length > 0) setActiveId(remaining[0].id);
    else await handleCreate();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeId) return;
    sendMessage({ text: input }, { body: { conversationId: activeId } });
    setInput("");
  }

  const isLoading = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const canRegenerate = !isLoading && lastMessage?.role === "assistant" && Boolean(activeId);

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-center px-6 py-4"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <a href="https://publicai.co" target="_blank" rel="noreferrer">
          <Logo height={28} assetsBase="/assets" />
        </a>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          className="w-full shrink-0 border-r p-6 md:w-72"
          style={{ borderColor: HAIRLINE }}
        >
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
          <hr className="my-6" style={{ borderColor: HAIRLINE }} />
          <ProfilePanel profile={profile} routing={routing} />
          {application && (
            <>
              <hr className="my-6" style={{ borderColor: HAIRLINE }} />
              <ApplicationPanel application={application} />
            </>
          )}
        </aside>

        <main className="flex flex-1 flex-col p-6">
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(28px, 4vw, var(--type-h3-size))",
              fontWeight: "var(--type-h3-weight)" as unknown as number,
            }}
          >
            Maine Aquaculture License Assistant
          </h1>
          <p className="mb-6 mt-2 max-w-2xl text-sm" style={{ color: MUTED }}>
            Conversational assistant for Maine aquaculture license triage and regulatory Q&amp;A.
            Proof of concept, not a substitute for DMR guidance.
          </p>

          <div className="flex-1 space-y-4 overflow-y-auto">
            <ChatBubble role="assistant" content={GREETING} />
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                content={message.parts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("")}
              />
            ))}
            {isLoading && <ChatBubble role="assistant" content="Thinking…" />}

            {canRegenerate && (
              <button
                onClick={() => regenerate({ body: { conversationId: activeId } })}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: HAIRLINE, color: MUTED }}
                title="Discard that answer and try again"
              >
                ↻ Regenerate
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex items-center gap-3">
            <input
              className="flex-1 rounded-full border px-5 py-3 text-sm outline-none"
              style={{ borderColor: HAIRLINE, fontFamily: "var(--font-sans)" }}
              placeholder="Describe your aquaculture operation, or ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || !activeId}
            />
            <Button>{isLoading ? "..." : "SEND"}</Button>
          </form>
        </main>
      </div>
    </div>
  );
}

/**
 * Tailwind's preflight strips list markers, heading sizes and table borders, so
 * every element the model might emit needs styling back or the answer arrives as
 * an undifferentiated block of text. Kept as one string rather than a `components`
 * map because these are purely visual defaults, not custom rendering.
 */
const MARKDOWN_STYLES = [
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
  "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
  "[&_li]:leading-snug [&_li>p]:mb-0",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_h1]:mb-1 [&_h1]:mt-3 [&_h1]:font-semibold [&_h1]:text-[15px]",
  "[&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-[15px]",
  "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold",
  "[&_hr]:my-3 [&_hr]:border-[color:var(--border-hairline)]",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--border-hairline)] [&_blockquote]:pl-3",
  "[&_code]:rounded [&_code]:bg-[color:var(--surface-subtle)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
  "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-[color:var(--border-hairline)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-[color:var(--border-hairline)] [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
].join(" ");

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div
      className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${MARKDOWN_STYLES}`}
      style={{
        marginLeft: isUser ? "auto" : undefined,
        background: isUser ? "var(--surface-subtle)" : "var(--surface-canvas)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Citations are links to DMR documents — open them in a new tab so a
          // user reading a source doesn't lose their place in the conversation.
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
