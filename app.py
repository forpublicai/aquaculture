"""Streamlit entry point for the Maine Aquaculture License Assistant."""

import streamlit as st

from src.chat.session import get_response
from src.config import APP_TITLE

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

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt := st.chat_input("Describe your aquaculture operation, or ask a question..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    response = get_response(prompt)
    st.session_state.messages.append({"role": "assistant", "content": response})
    with st.chat_message("assistant"):
        st.markdown(response)
