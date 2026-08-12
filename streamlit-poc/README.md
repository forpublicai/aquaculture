# Maine Aquaculture License Assistant (Proof of Concept)

A conversational AI tool that helps prospective and current Maine aquaculture
proprietors identify the correct license/permit application, walks them
through a natural-language intake interview, and answers regulatory
questions via retrieval-augmented generation (RAG) over DMR documentation.

Scope for this POC is intentionally narrow: conversational triage, intake,
and document Q&A. It does **not** handle external bottlenecks like riparian
landowner lookups, tax map generation, or scoping-session logistics.

> **Status:** all four build phases below are implemented and verified
> working (Streamlit UI, license routing, RAG Q&A, unified session). This
> codebase is the validated POC — a rewrite to Next.js on Vercel is planned
> next, driven by needing the [Public AI Design
> System](https://github.com/forpublicai/design-system) (real React
> components, not usable from Streamlit) and persistent state for saved/
> resumable applications. The routing rules and RAG pipeline here port over;
> the Streamlit UI does not.

## Architecture

- **Frontend:** [Streamlit](https://streamlit.io/) chat interface
- **Orchestration:** [LangChain](https://python.langchain.com/), using
  `ChatOpenAI` pointed at [OpenRouter](https://openrouter.ai/)'s
  OpenAI-compatible endpoint rather than calling Anthropic directly. The
  model is still **Claude Opus 5** (`OPENROUTER_MODEL`, default
  `anthropic/claude-opus-5`) — only the request path changes.
- **Vector store:** [ChromaDB](https://www.trychroma.com/) (local, persisted
  to disk), via `langchain-chroma`
- **Embeddings:** local `sentence-transformers` model by default — no extra
  API key required for the POC; swap for a hosted embedding provider later
  via `EMBEDDING_MODEL` in `.env`

## Project structure

```
app.py                  Streamlit entry point / chat UI
src/
  config.py               Environment-driven settings
  llm.py                  Shared OpenRouter-routed chat model client
  chat/
    intent.py               Per-message intent classification (triage / regulatory / other)
    session.py               Unified session: routes intent, tracks ConversationState
  routing/
    schema.py                OperationProfile / RoutingResult (Pydantic)
    rules.py                  Deterministic LPA / Experimental / Standard Lease logic
    interview.py              Structured extraction + conversational follow-up
  rag/
    ingest.py                 Document loading, chunking, Chroma indexing
    qa_chain.py                Grounded retrieval + answer generation
data/
  knowledge_base/          Source regulatory/application documents (gitignored, empty by
                            default — see Regulatory knowledge base below)
  vector_store/             Persisted Chroma DB (gitignored)
tests/
```

## Setup

1. Create and activate a virtual environment:
   ```
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and add your OpenRouter API key
   (get one at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)):
   ```
   cp .env.example .env
   ```
4. Run the app:
   ```
   streamlit run app.py
   ```

## Regulatory knowledge base

`data/knowledge_base/` is empty by default and gitignored. The RAG chain
(`src/rag/qa_chain.py`) is written to fail safe when it's empty — it tells
the user it has no documents loaded rather than guessing at regulations. To
enable regulatory Q&A, drop real Maine DMR application forms, statutes, or
guidance documents (PDF/TXT/MD) into that directory and run:

```
python -m src.rag.ingest
```

## Development phases

1. **Environment & UI setup** — repo structure, dependencies, chat shell ✅
2. **Routing logic (Feature A)** — intake interview → license recommendation ✅
3. **RAG Q&A pipeline (Feature B)** — document ingestion, vector store, retrieval chain ✅
4. **Integration & state management** — unified chat session handling all intents ✅

All four phases are implemented and verified working end-to-end. Next planned
step is a rewrite to Next.js on Vercel — see the Status note above.
