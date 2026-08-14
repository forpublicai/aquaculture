"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";

import { Logo } from "@/design-system/components/brand/Logo";
import { Button } from "@/design-system/components/buttons/Button";
import type { OperationProfile, RoutingResult } from "@/lib/routing/schema";

const GREETING =
  "Hi! I can help you figure out which aquaculture license you need and answer " +
  "questions about Maine DMR regulations. What are you looking to do?";

const FIELD_LABELS: { key: keyof OperationProfile; label: string }[] = [
  { key: "species", label: "Species" },
  { key: "gearType", label: "Gear / method" },
  { key: "siteAreaSqFt", label: "Site area (sq ft)" },
  { key: "leaseDurationYears", label: "Lease duration (years)" },
];

function ProfileSidebar({
  profile,
  routing,
}: {
  profile: OperationProfile | null;
  routing: RoutingResult | null;
}) {
  return (
    <aside className="w-full shrink-0 border-r p-6 md:w-72" style={{ borderColor: "var(--border-hairline)" }}>
      <h2
        className="mb-4"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "var(--type-section-size)",
          fontWeight: "var(--type-section-weight)" as unknown as number,
        }}
      >
        Application profile
      </h2>
      <dl className="space-y-3 text-sm">
        {FIELD_LABELS.map(({ key, label }) => {
          const value = profile?.[key];
          const display = Array.isArray(value) ? value.join(", ") : value;
          return (
            <div key={key}>
              <dt className="font-semibold">{label}</dt>
              <dd className="italic" style={{ color: "var(--pai-gray-800)" }}>
                {display ? display : "not yet provided"}
              </dd>
            </div>
          );
        })}
      </dl>
      <hr className="my-5" style={{ borderColor: "var(--border-hairline)" }} />
      {routing && routing.licenseType !== "Undetermined — more information needed" ? (
        <div
          className="rounded p-3 text-sm font-semibold"
          style={{ background: "var(--surface-subtle)", color: "var(--pai-black)" }}
        >
          Recommended: {routing.licenseType}
        </div>
      ) : (
        <div className="text-sm" style={{ color: "var(--pai-gray-800)" }}>
          Still gathering details to recommend a license type.
        </div>
      )}
    </aside>
  );
}

export function Chat() {
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<OperationProfile | null>(null);
  const [routing, setRouting] = useState<RoutingResult | null>(null);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      refreshProfile();
    },
  });

  async function refreshProfile() {
    const res = await fetch("/api/conversation");
    const data = await res.json();
    setProfile(data.profile);
    setRouting(data.routing);
  }

  // On first mount, pull the saved conversation back out of the database so
  // a page refresh doesn't lose the transcript. The ref guard keeps this to
  // exactly one run even under React's development double-render.
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    (async () => {
      const res = await fetch("/api/conversation");
      const data = await res.json();
      setProfile(data.profile);
      setRouting(data.routing);
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-center px-6 py-4"
        style={{ borderBottom: "1px solid var(--border-hairline)" }}
      >
        <a href="https://publicai.co" target="_blank" rel="noreferrer">
          <Logo height={28} assetsBase="/assets" />
        </a>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <ProfileSidebar profile={profile} routing={routing} />
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
          <p className="mb-6 mt-2 max-w-2xl text-sm" style={{ color: "var(--pai-gray-800)" }}>
            Conversational assistant for Maine aquaculture license triage and regulatory Q&amp;A.
            Proof of concept — not a substitute for DMR guidance.
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
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex items-center gap-3">
            <input
              className="flex-1 rounded-full border px-5 py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-hairline)", fontFamily: "var(--font-sans)" }}
              placeholder="Describe your aquaculture operation, or ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <Button>{isLoading ? "..." : "SEND"}</Button>
          </form>
        </main>
      </div>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div
      className="max-w-2xl rounded-2xl px-4 py-3 text-sm [&_p]:mb-2 [&_p:last-child]:mb-0"
      style={{
        marginLeft: isUser ? "auto" : undefined,
        background: isUser ? "var(--surface-subtle)" : "var(--surface-canvas)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
