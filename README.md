# Maine Aquaculture License Assistant (Proof of Concept)

A conversational AI tool that helps prospective and current Maine aquaculture
proprietors identify the correct license/permit application, walks them
through a natural-language intake interview, and answers regulatory
questions via retrieval-augmented generation (RAG) over DMR documentation.

Scope for this POC is intentionally narrow: conversational triage, intake,
and document Q&A. It does **not** handle external bottlenecks like riparian
landowner lookups, tax map generation, or scoping-session logistics.

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
app.py                 Streamlit entry point / chat UI
src/
  config.py             Environment-driven settings
  chat/                 Session state, response dispatch (Phase 4)
  routing/               License triage & routing logic (Phase 2)
  rag/                    Document ingestion, vector store, RAG chain (Phase 3)
  intake/                 Conversational data extraction (Phase 2/4)
data/
  knowledge_base/        Source regulatory/application documents (gitignored)
  vector_store/           Persisted Chroma DB (gitignored)
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

## Development phases

1. **Environment & UI setup** — repo structure, dependencies, chat shell (this phase)
2. **Routing logic (Feature A)** — intake interview → license recommendation
3. **RAG Q&A pipeline (Feature B)** — document ingestion, vector store, retrieval chain
4. **Integration & state management** — unified chat session handling all intents

Each phase builds on the last; see `src/` module docstrings for what's stubbed vs. implemented at any given point.
