from threading import Lock
from typing import TypedDict

from core.config import get_settings


class ConversationTurn(TypedDict):
    question: str
    answer: str


_memory: dict[str, list[ConversationTurn]] = {}
_lock = Lock()


def get_history(session_id: str | None) -> list[ConversationTurn]:
    if not session_id:
        return []

    with _lock:
        return list(_memory.get(session_id, []))


def append_turn(session_id: str | None, question: str, answer: str) -> None:
    if not session_id:
        return

    settings = get_settings()
    with _lock:
        turns = _memory.setdefault(session_id, [])
        turns.append({"question": question, "answer": answer})
        del turns[: max(0, len(turns) - settings.conversation_memory_turns)]


def build_history_context(history: list[ConversationTurn]) -> str:
    if not history:
        return ""

    return "\n\n".join(
        f"User: {turn['question']}\nAssistant: {turn['answer']}"
        for turn in history
    )


def build_retrieval_question(question: str, history: list[ConversationTurn]) -> str:
    if not history:
        return question

    recent = history[-3:]
    history_text = "\n".join(
        f"Previous question: {turn['question']}\nPrevious answer: {turn['answer']}"
        for turn in recent
    )
    return f"{history_text}\nFollow-up question: {question}"
