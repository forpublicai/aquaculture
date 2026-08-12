# Maine Aquaculture License Assistant

A conversational AI tool that helps prospective and current Maine aquaculture
proprietors identify the correct license/permit application, walks them
through a natural-language intake interview, and answers regulatory
questions via retrieval-augmented generation (RAG) over DMR documentation.

Scope is intentionally narrow: conversational triage, intake, and document
Q&A. It does **not** handle external bottlenecks like riparian landowner
lookups, tax map generation, or scoping-session logistics.

## Status

This is the Next.js/Vercel rebuild of the original Streamlit proof of
concept (preserved at [`streamlit-poc/`](streamlit-poc/), still runnable).
The rebuild was driven by two things: the app needs a real database for
saved/resumable applications regardless of host, and the UI needs the
[Public AI Design System](https://github.com/forpublicai/design-system) —
real React components with no npm package, which Streamlit can't consume.

All four original build phases (routing, intake, RAG, integration) are
reimplemented here in TypeScript and verified working end-to-end locally.
**Not yet done:** deploying to Vercel itself, and populating the regulatory
knowledge base with real DMR documents (it ships empty — see below).

## Architecture

- **Frontend:** Next.js 16 (App Router) + the [Vercel AI SDK](https://ai-sdk.dev/)'s
  `useChat`, styled with the [Public AI Design System](design-system/)
  (pulled in as a git subtree, not a submodule or npm package — see
  `design-system/README.md` for why) + Tailwind for layout.
- **LLM:** [OpenRouter](https://openrouter.ai/) → **Claude Opus 5**
  (`OPENROUTER_MODEL`), via `@openrouter/ai-sdk-provider`. One API key
  covers both chat completions and embeddings — OpenRouter proxies both.
- **Embeddings:** OpenRouter → `openai/text-embedding-3-small` by default
  (`OPENROUTER_EMBEDDING_MODEL`). No separate provider key needed.
- **Database:** [Supabase](https://supabase.com/) (Postgres + `pgvector`) —
  one service for both conversation/application state (so an applicant can
  leave and resume) and the regulatory-document vector store. Schema:
  [`supabase/schema.sql`](supabase/schema.sql).

## Project structure

```
app/
  page.tsx                Chat UI entry point
  layout.tsx               Root layout — imports design tokens
  globals.css               Tailwind + design-system tokens (see comments on import order)
  api/
    chat/route.ts            Streaming chat endpoint (useChat transport target)
    conversation/route.ts     Returns current session's profile + recommendation (sidebar)
components/
  Chat.tsx                 Chat UI: message list, input, profile sidebar
lib/
  openrouter.ts             Shared OpenRouter chat + embedding model instances
  supabase.ts                Service-role Supabase client (server-only)
  chat/
    intent.ts                 Per-message intent classification
    session.ts                  Load/save conversation state, route intent → triage or RAG
    respond.ts                   Streams a deterministic string in useChat's wire format
  routing/
    schema.ts                  OperationProfile / RoutingResult (Zod)
    rules.ts                    Deterministic LPA / Experimental / Standard Lease logic
    interview.ts                 Structured extraction + conversational follow-up
  rag/
    chunk.ts                    Minimal recursive text splitter
    qa.ts                        Grounded retrieval + streamed answer generation
scripts/
  ingest.ts                 Document ingestion CLI (see below)
supabase/
  schema.sql                Conversations table + pgvector store + match function
data/
  knowledge_base/          Source regulatory/application documents (gitignored, empty by default)
design-system/             Public AI Design System (git subtree)
streamlit-poc/              Original Streamlit proof of concept (preserved, still runnable)
```

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - `OPENROUTER_API_KEY` — [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase project settings → API
   - `POSTGRES_URL_NON_POOLING` — Supabase project settings → Database (used once, for the schema migration below)
3. Apply the database schema:
   ```
   psql "$POSTGRES_URL_NON_POOLING" -f supabase/schema.sql
   ```
4. Run the app:
   ```
   npm run dev
   ```

## Regulatory knowledge base

`data/knowledge_base/` is empty by default and gitignored. The RAG chain
(`lib/rag/qa.ts`) fails safe when it's empty — it tells the user it has no
documents loaded rather than guessing at regulations. To enable regulatory
Q&A, drop real Maine DMR application forms, statutes, or guidance documents
(PDF/TXT/MD) into that directory and run:

```
npm run ingest
```

## Design system

Pulled in as a git subtree at [`design-system/`](design-system/) — see that
directory's own README for the ground rules (brand red used sparingly,
near-monochrome otherwise, no gray text). It also ships as a Claude Code
skill (symlinked at `.claude/skills/public-ai-design`), so `/public-ai-design`
is available when extending the UI.

To pull upstream updates:

```
git subtree pull --prefix=design-system https://github.com/forpublicai/design-system.git main --squash
```

Note: `app/globals.css` imports the design tokens directly (not via
`design-system/styles.css`) and in a specific order — see the comments in
that file for why (Turbopack's CSS bundling has opinions about `@import`
ordering and local font-asset resolution that the design system's own
`styles.css` doesn't anticipate).

## Known gaps

- Chat transcript isn't persisted/rehydrated across a page reload — only the
  extracted profile and routing recommendation are (`conversations` table).
  A full "leave and resume the conversation" experience needs the message
  history persisted and replayed into `useChat`'s initial state too.
- Not yet deployed to Vercel.
