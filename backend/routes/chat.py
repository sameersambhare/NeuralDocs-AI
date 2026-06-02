import logging

from fastapi import APIRouter, HTTPException

from models.requests import ChatRequest
from models.responses import ChatResponse
from services.context_builder import build_context, build_sources
from services.hybrid_retrieval_service import retrieve
from services.llm_service import generate_answer

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        chunks = retrieve(request.question)
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

    try:
        answer = generate_answer(request.question, context)
    except Exception as exc:
        logger.exception("Answer generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {exc}",
        ) from exc

    return ChatResponse(answer=answer, sources=build_sources(chunks))
