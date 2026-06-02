import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.requests import ChatRequest
from models.responses import ChatResponse
from services.context_builder import build_context, build_sources
from services.conversation_memory_service import (
    append_turn,
    build_history_context,
    build_retrieval_question,
    get_history,
)
from services.hybrid_retrieval_service import retrieve
from services.llm_service import generate_answer, stream_answer

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    history = get_history(request.session_id)
    retrieval_question = build_retrieval_question(request.question, history)

    try:
        chunks = retrieve(retrieval_question, request.workspace_id, request.filenames)
    except Exception as exc:
        logger.exception("Retrieval failed")
        raise HTTPException(
            status_code=500,
            detail=f"Retrieval failed: {exc}",
        ) from exc

    if not chunks:
        return ChatResponse(
            answer="I do not know from the uploaded documents.",
            sources=[],
        )

    context = build_context(chunks)
    chat_history = build_history_context(history)

    try:
        answer = generate_answer(request.question, context, chat_history)
    except Exception as exc:
        logger.exception("Answer generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {exc}",
        ) from exc

    append_turn(request.session_id, request.question, answer)

    return ChatResponse(answer=answer, sources=build_sources(chunks))


@router.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    def event_stream():
        history = get_history(request.session_id)
        retrieval_question = build_retrieval_question(request.question, history)

        try:
            chunks = retrieve(retrieval_question, request.workspace_id, request.filenames)
        except Exception as exc:
            logger.exception("Retrieval failed")
            yield _sse("error", {"detail": f"Retrieval failed: {exc}"})
            return

        sources = build_sources(chunks)
        if not chunks:
            answer = "I do not know from the uploaded documents."
            yield _sse("token", {"text": answer})
            yield _sse("sources", {"sources": []})
            yield _sse("done", {})
            append_turn(request.session_id, request.question, answer)
            return

        context = build_context(chunks)
        chat_history = build_history_context(history)
        answer_parts: list[str] = []

        try:
            for token in stream_answer(request.question, context, chat_history):
                answer_parts.append(token)
                yield _sse("token", {"text": token})
        except Exception as exc:
            logger.exception("Answer streaming failed")
            yield _sse("error", {"detail": f"Failed to stream answer: {exc}"})
            return

        answer = "".join(answer_parts)
        append_turn(request.session_id, request.question, answer)
        yield _sse("sources", {"sources": sources})
        yield _sse("done", {})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"
