import math
from typing import Any

from database.supabase import get_supabase_client
from core.config import get_settings
from services.text_normalization import clean_value


def save_chunks(chunks: list[dict[str, Any]]) -> int:
    if not chunks:
        return 0

    settings = get_settings()
    client = get_supabase_client()
    cleaned_chunks = [clean_value(chunk) for chunk in chunks]
    client.table(settings.supabase_table).insert(cleaned_chunks).execute()
    return len(chunks)


def vector_search(
    query_embedding: list[float],
    k: int,
    workspace_id: str | None = None,
    filenames: list[str] | None = None,
) -> list[dict[str, Any]]:
    settings = get_settings()
    client = get_supabase_client()

    try:
        params = {
            "query_embedding": query_embedding,
            "match_count": k,
            "workspace_filter": workspace_id,
            "filename_filters": filenames,
        }
        response = client.rpc("match_document_chunks", params).execute()
        return response.data or []
    except Exception:
        return _fallback_vector_search(query_embedding, k, workspace_id, filenames)


def get_all_chunks(
    workspace_id: str | None = None,
    filenames: list[str] | None = None,
) -> list[dict[str, Any]]:
    settings = get_settings()
    client = get_supabase_client()

    query = (
        client.table(settings.supabase_table)
        .select(
            "id, content, embedding, filename, page, workspace_id, "
            "content_type, extraction_method, table_index"
        )
    )

    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    if filenames:
        query = query.in_("filename", filenames)

    response = query.execute()
    return response.data or []


def get_workspace_files(workspace_id: str | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    client = get_supabase_client()

    query = (
        client.table(settings.supabase_table)
        .select("filename, page, content_type")
        .order("filename")
        .order("page", desc=False)
    )

    if workspace_id:
        query = query.eq("workspace_id", workspace_id)

    response = query.execute()
    rows = response.data or []

    files: dict[str, dict[str, Any]] = {}
    for row in rows:
        filename = row.get("filename") or "unknown"
        file_entry = files.setdefault(
            filename,
            {
                "filename": filename,
                "chunk_count": 0,
                "last_page": None,
                "content_types": [],
            },
        )
        file_entry["chunk_count"] += 1
        page = row.get("page")
        if isinstance(page, int):
            file_entry["last_page"] = max(page, file_entry["last_page"] or page)
        content_type = row.get("content_type")
        if content_type and content_type not in file_entry["content_types"]:
            file_entry["content_types"].append(content_type)

    return list(files.values())


def delete_workspace_file(workspace_id: str, filename: str) -> int:
    settings = get_settings()
    client = get_supabase_client()

    existing = (
        client.table(settings.supabase_table)
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("filename", filename)
        .execute()
    )
    rows = existing.data or []
    if not rows:
        return 0

    client.table(settings.supabase_table).delete().eq("workspace_id", workspace_id).eq(
        "filename", filename
    ).execute()

    return len(rows)


def _fallback_vector_search(
    query_embedding: list[float],
    k: int,
    workspace_id: str | None = None,
    filenames: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = get_all_chunks(workspace_id, filenames)
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
