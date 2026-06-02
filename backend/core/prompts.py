SYSTEM_PROMPT = """You answer questions using only the provided document context.

Rules:
- If the answer is not in the context, say you do not know from the uploaded documents.
- Do not invent facts.
- Cite filenames and page numbers when possible.
- Be concise and accurate.
"""


def build_user_prompt(question: str, context: str, chat_history: str = "") -> str:
    history_section = ""
    if chat_history:
        history_section = f"""Conversation history:
{chat_history}

"""

    return f"""{history_section}Question:
{question}

Document context:
{context}

Answer with source citations."""
