from typing import Any

from core.config import get_settings
from services.bm25_service import bm25_search
from services.embedding_service import embed_text
from services.rrf_service import reciprocal_rank_fusion
from services.vector_store_service import vector_search


def retrieve(
    question: str,
    workspace_id: str | None = None,
    filenames: list[str] | None = None,
) -> list[dict[str, Any]]:
    settings = get_settings()
    filenames = filenames or None
    question_embedding = embed_text(question)

    vector_results = vector_search(
        question_embedding,
        settings.vector_k,
        workspace_id,
        filenames,
    )
    bm25_results = bm25_search(question, settings.bm25_k, workspace_id, filenames)

    return reciprocal_rank_fusion(
        [vector_results, bm25_results],
        top_k=settings.final_k,
    )
