"""Unified chat session: routes each message to the license-triage interview
or regulatory Q&A based on intent, and tracks accumulated intake state.
"""

from dataclasses import dataclass, field

from src.chat.intent import classify_intent
from src.rag.qa_chain import answer_question
from src.routing.interview import next_question, run_interview_turn
from src.routing.rules import route
from src.routing.schema import LicenseType, OperationProfile, RoutingResult


@dataclass
class ConversationState:
    profile: OperationProfile = field(default_factory=OperationProfile)
    routing: RoutingResult = field(
        default_factory=lambda: RoutingResult(
            license_type=LicenseType.UNDETERMINED,
            rationale="",
            missing_fields=list(route(OperationProfile()).missing_fields),
        )
    )


def _answer_regulatory_question(user_message: str) -> str:
    result = answer_question(user_message)
    answer = result["answer"]
    if result["sources"]:
        answer += f"\n\n*Sources: {', '.join(result['sources'])}*"
    return answer


def _handle_other(state: ConversationState) -> str:
    if state.routing.missing_fields:
        return f"Happy to help! {next_question(state.profile)}"
    return (
        "Happy to help! Ask me anything about Maine DMR aquaculture regulations, "
        "or let me know if anything about your operation has changed."
    )


def handle_message(state: ConversationState, user_message: str) -> str:
    """Process one user message against the given state (mutated in place)
    and return the assistant's reply text.
    """
    intent = classify_intent(user_message)

    if intent == "regulatory_question":
        return _answer_regulatory_question(user_message)

    if intent == "other":
        return _handle_other(state)

    profile, routing, reply = run_interview_turn(state.profile, user_message)
    state.profile = profile
    state.routing = routing
    return reply
