"""Centralized application configuration, loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# --- LLM ---
# Requests are routed through OpenRouter rather than calling Anthropic
# directly; the model itself stays Claude Opus 5. Verify OPENROUTER_MODEL
# against https://openrouter.ai/models if OpenRouter's slug changes.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-opus-5")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Maine Aquaculture License Assistant")

# --- Embeddings ---
# Local sentence-transformers model — no external API key required for the POC.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# --- Vector store (Feature B: RAG) ---
VECTOR_STORE_DIR = str(BASE_DIR / os.getenv("VECTOR_STORE_DIR", "data/vector_store"))
KNOWLEDGE_BASE_DIR = str(BASE_DIR / os.getenv("KNOWLEDGE_BASE_DIR", "data/knowledge_base"))

# --- App ---
APP_TITLE = "Maine Aquaculture License Assistant"
