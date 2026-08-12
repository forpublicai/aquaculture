"""Document ingestion for the regulatory knowledge base.

Walks KNOWLEDGE_BASE_DIR for local PDF/text/Markdown documents, splits them
into chunks, embeds them, and persists them to a local Chroma vector store.
Drop real Maine DMR application forms, statutes, and guidance documents into
`data/knowledge_base/` and run `python -m src.rag.ingest` (or call
`build_or_load_vector_store(force_rebuild=True)`) to index them.
"""

import logging
import os

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import EMBEDDING_MODEL, KNOWLEDGE_BASE_DIR, VECTOR_STORE_DIR

logger = logging.getLogger(__name__)

COLLECTION_NAME = "dmr_aquaculture_docs"

LOADERS_BY_EXTENSION = {
    ".pdf": PyPDFLoader,
    ".txt": TextLoader,
    ".md": TextLoader,
}


def load_documents(directory: str = KNOWLEDGE_BASE_DIR) -> list[Document]:
    """Load every supported document under `directory`. Returns an empty
    list (rather than raising) if the directory is missing or has no
    supported files — the app should degrade gracefully, not crash, when
    the knowledge base hasn't been populated yet.
    """
    if not os.path.isdir(directory):
        logger.warning("Knowledge base directory not found: %s", directory)
        return []

    documents: list[Document] = []
    for root, _dirs, files in os.walk(directory):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            loader_cls = LOADERS_BY_EXTENSION.get(ext)
            if loader_cls is None:
                continue
            path = os.path.join(root, filename)
            try:
                documents.extend(loader_cls(path).load())
            except Exception:
                logger.exception("Failed to load document: %s", path)

    if not documents:
        logger.warning("No supported documents found in %s — knowledge base is empty.", directory)
    return documents


def split_documents(documents: list[Document]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(documents)


def get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def build_or_load_vector_store(force_rebuild: bool = False) -> Chroma:
    """Return the persisted Chroma vector store, building it from
    `KNOWLEDGE_BASE_DIR` if it doesn't exist yet or `force_rebuild=True`.
    """
    embeddings = get_embeddings()
    already_persisted = os.path.isdir(VECTOR_STORE_DIR) and os.listdir(VECTOR_STORE_DIR)

    vector_store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=VECTOR_STORE_DIR,
    )

    if already_persisted and not force_rebuild:
        return vector_store

    if force_rebuild and vector_store._collection.count() > 0:
        vector_store.delete_collection()
        vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=VECTOR_STORE_DIR,
        )

    chunks = split_documents(load_documents())
    if chunks:
        vector_store.add_documents(chunks)
        logger.info("Indexed %d chunks from %s into %s", len(chunks), KNOWLEDGE_BASE_DIR, VECTOR_STORE_DIR)

    return vector_store


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    store = build_or_load_vector_store(force_rebuild=True)
    print(f"Vector store ready at {VECTOR_STORE_DIR} with {store._collection.count()} chunks.")
