"""Retrieval-augmented Q&A over the DMR regulatory knowledge base."""

from functools import lru_cache

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage

from src.llm import get_chat_model
from src.rag.ingest import build_or_load_vector_store

EMPTY_KB_MESSAGE = (
    "I don't have any regulatory documents loaded yet to answer that from — the "
    "knowledge base is empty. Add Maine DMR application forms, statutes, or guidance "
    "documents to `data/knowledge_base/` and re-run ingestion, or check with DMR directly "
    "in the meantime."
)

RAG_SYSTEM_PROMPT = """You are a regulatory Q&A assistant for Maine aquaculture \
license applicants. Answer the applicant's question using ONLY the context \
documents provided below — do not rely on outside knowledge of Maine DMR \
rules, since it may be outdated or wrong.

If the context doesn't contain enough information to answer confidently, say \
so plainly and suggest the applicant check with DMR directly. Never present \
a guess as a confirmed regulatory requirement.

When you do answer from the context, keep it concise and cite which document \
the information came from.

Context:
{context}"""


@lru_cache(maxsize=1)
def _get_vector_store():
    return build_or_load_vector_store()


def _format_context(docs: list[Document]) -> str:
    parts = []
    for i, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "unknown source")
        page = doc.metadata.get("page")
        label = f"[{i}] {source}" + (f" (page {page + 1})" if page is not None else "")
        parts.append(f"{label}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def answer_question(question: str, k: int = 4) -> dict:
    """Answer a regulatory question from the knowledge base.

    Returns {"answer": str, "sources": list[str]}. `sources` is empty when
    the knowledge base has no documents or nothing relevant was retrieved.
    """
    vector_store = _get_vector_store()
    if vector_store._collection.count() == 0:
        return {"answer": EMPTY_KB_MESSAGE, "sources": []}

    retriever = vector_store.as_retriever(search_kwargs={"k": k})
    docs = retriever.invoke(question)
    if not docs:
        return {"answer": EMPTY_KB_MESSAGE, "sources": []}

    llm = get_chat_model(temperature=0.1)
    messages = [
        SystemMessage(content=RAG_SYSTEM_PROMPT.format(context=_format_context(docs))),
        HumanMessage(content=question),
    ]
    response = llm.invoke(messages)

    sources = sorted({doc.metadata.get("source", "unknown source") for doc in docs})
    return {"answer": response.content, "sources": sources}
