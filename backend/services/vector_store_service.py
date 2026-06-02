import math
from typing import Any

from database.supabase import get_supabase_client
from core.config import get_settings


def save_chunks(chunks: list[dict[str, Any]]) -> int:
    if not chunks:
        return 0

    settings = get_settings()
    client = get_supabase_client()
    client.table(settings.supabase_table).insert(chunks).execute()
    return len(chunks)


def vector_search(query_embedding: list[float], k: int) -> list[dict[str, Any]]:
    settings = get_settings()
    client = get_supabase_client()

    try:
        response = client.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_count": k,
            },
        ).execute()
        return response.data or []
    except Exception:
        return _fallback_vector_search(query_embedding, k)


def get_all_chunks() -> list[dict[str, Any]]:
    settings = get_settings()
    client = get_supabase_client()
    response = (
        client.table(settings.supabase_table)
        .select("id, content, embedding, filename, page")
        .execute()
    )
    return response.data or []


def _fallback_vector_search(query_embedding: list[float], k: int) -> list[dict[str, Any]]:
    rows = get_all_chunks()
    for row in rows:
        row["similarity"] = _cosine_similarity(query_embedding, row.get("embedding") or [])
    return sorted(rows, key=lambda item: item.get("similarity", 0), reverse=True)[:k]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
