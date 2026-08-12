"""Per-message intent classification, so the chat session can route between
the license-triage interview and regulatory Q&A."""

from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.llm import get_chat_model

Intent = Literal["license_triage", "regulatory_question", "other"]

INTENT_SYSTEM_PROMPT = """Classify the applicant's latest chat message into exactly \
one category:

- license_triage: describes their (prospective) operation or answers a scoping \
question about species, gear/cultivation method, site size, or lease duration.
- regulatory_question: asks about rules, requirements, definitions, fees, \
timelines, or the application process itself.
- other: greetings, thanks, or anything unrelated to either of the above."""


class IntentClassification(BaseModel):
    intent: Intent = Field(description="One of: license_triage, regulatory_question, other.")


def classify_intent(message: str) -> Intent:
    llm = get_chat_model(temperature=0)
    structured_llm = llm.with_structured_output(IntentClassification)
    result = structured_llm.invoke(
        [
            SystemMessage(content=INTENT_SYSTEM_PROMPT),
            HumanMessage(content=message),
        ]
    )
    classification = (
        result if isinstance(result, IntentClassification) else IntentClassification.model_validate(result)
    )
    return classification.intent
