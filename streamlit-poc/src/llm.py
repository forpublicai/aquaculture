"""Shared chat model client, routed through OpenRouter to Claude Opus 5."""

from functools import lru_cache

from langchain_openai import ChatOpenAI

from src.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_APP_NAME,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
    OPENROUTER_SITE_URL,
)


@lru_cache(maxsize=None)
def get_chat_model(temperature: float = 0.2) -> ChatOpenAI:
    """Return a cached ChatOpenAI client pointed at OpenRouter.

    Cached per temperature value so different call sites (deterministic
    extraction vs. more conversational Q&A) can request different settings
    without re-instantiating a client on every call.
    """
    default_headers = {}
    if OPENROUTER_SITE_URL:
        default_headers["HTTP-Referer"] = OPENROUTER_SITE_URL
    if OPENROUTER_APP_NAME:
        default_headers["X-Title"] = OPENROUTER_APP_NAME

    return ChatOpenAI(
        model=OPENROUTER_MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        temperature=temperature,
        default_headers=default_headers or None,
    )
