"""Conversational intake interview: extracts structured operation details
from natural-language messages and drives the license-triage routing.
"""

from langchain_core.messages import HumanMessage, SystemMessage

from src.llm import get_chat_model
from src.routing.rules import FIELD_PROMPTS, route
from src.routing.schema import OperationProfile, RoutingResult

EXTRACTION_SYSTEM_PROMPT = """You extract structured details about a prospective \
Maine aquaculture operation from a conversation, for the purpose of \
recommending which DMR license type the applicant should pursue.

You are given the fields already known from earlier in the conversation, \
plus the applicant's latest message. Return the FULL set of fields:
- Carry forward any already-known field the latest message doesn't contradict.
- Update a field if the latest message gives new or corrected information for it.
- Leave a field null if it has never been mentioned.
- Convert acres to square feet (1 acre = 43,560 sq ft) for site_area_sq_ft.
- Only set is_first_time_applicant or wants_to_test_before_committing when the \
applicant has actually said something that implies it — don't guess.

Do not ask questions yourself here; you are only extracting data."""


def update_profile(current: OperationProfile, latest_user_message: str) -> OperationProfile:
    llm = get_chat_model(temperature=0)
    structured_llm = llm.with_structured_output(OperationProfile)
    messages = [
        SystemMessage(content=EXTRACTION_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Fields already known (JSON): {current.model_dump_json()}\n\n"
                f"Applicant's latest message: {latest_user_message}"
            )
        ),
    ]
    result = structured_llm.invoke(messages)
    return result if isinstance(result, OperationProfile) else OperationProfile.model_validate(result)


def next_question(profile: OperationProfile) -> str:
    """Return a natural-language prompt for the next missing required field."""
    routing = route(profile)
    if not routing.missing_fields:
        return ""
    field = routing.missing_fields[0]
    return f"Could you tell me {FIELD_PROMPTS[field]}?"


def run_interview_turn(current: OperationProfile, user_message: str) -> tuple[OperationProfile, RoutingResult, str]:
    """Process one user turn: update the profile, route it, and produce the
    assistant's reply text (either a follow-up question or a recommendation).
    """
    profile = update_profile(current, user_message)
    routing = route(profile)

    if routing.missing_fields:
        reply = next_question(profile)
        return profile, routing, reply

    reply = format_recommendation(routing)
    return profile, routing, reply


def format_recommendation(routing: RoutingResult) -> str:
    lines = [
        f"Based on what you've described, this sounds like a fit for a **{routing.license_type.value}**.",
        "",
        routing.rationale,
    ]
    if routing.incompatibility_warning:
        lines += ["", f"⚠️ {routing.incompatibility_warning}"]
    lines += [
        "",
        "This is a preliminary read, not a final determination — feel free to ask me "
        "regulatory questions about this license type, or double-check details with DMR "
        "directly before applying.",
    ]
    return "\n".join(lines)
