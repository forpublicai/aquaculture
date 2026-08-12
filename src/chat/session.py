"""Chat session state and response dispatch.

Phase 1 stub: echoes a placeholder response so the Streamlit shell is
functional end-to-end. Phase 2 (routing), Phase 3 (RAG), and Phase 4
(integration) replace `get_response` with real intent handling.
"""

PLACEHOLDER_RESPONSE = (
    "Thanks for your message. The license triage and regulatory Q&A logic "
    "hasn't been built yet — that comes in later phases. For now, this is a "
    "working chat shell."
)


def get_response(user_message: str) -> str:
    return PLACEHOLDER_RESPONSE
