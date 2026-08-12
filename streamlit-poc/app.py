"""Streamlit entry point for the Maine Aquaculture License Assistant."""

import streamlit as st

from src.chat.session import ConversationState, handle_message
from src.config import APP_TITLE
from src.routing.schema import LicenseType

st.set_page_config(page_title=APP_TITLE, page_icon="🦪", layout="centered")

st.title(APP_TITLE)
st.caption(
    "Conversational assistant for Maine aquaculture license triage and "
    "regulatory Q&A. Proof of concept — not a substitute for DMR guidance."
)

if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": (
                "Hi! I can help you figure out which aquaculture license "
                "you need and answer questions about Maine DMR regulations. "
                "What are you looking to do?"
            ),
        }
    ]
if "conversation_state" not in st.session_state:
    st.session_state.conversation_state = ConversationState()

state: ConversationState = st.session_state.conversation_state

with st.sidebar:
    st.subheader("Application profile")
    profile_fields = {
        "Species": ", ".join(state.profile.species) if state.profile.species else None,
        "Gear / method": state.profile.gear_type,
        "Site area (sq ft)": state.profile.site_area_sq_ft,
        "Lease duration (years)": state.profile.lease_duration_years,
    }
    for label, value in profile_fields.items():
        st.markdown(f"**{label}:** {value if value not in (None, '') else '_not yet provided_'}")

    st.divider()
    if state.routing.license_type != LicenseType.UNDETERMINED:
        st.success(f"Recommended: {state.routing.license_type.value}")
    else:
        st.info("Still gathering details to recommend a license type.")

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt := st.chat_input("Describe your aquaculture operation, or ask a question..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = handle_message(state, prompt)
        st.markdown(response)
    st.session_state.messages.append({"role": "assistant", "content": response})
    st.rerun()
