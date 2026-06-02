import re
from typing import Any

from rank_bm25 import BM25Okapi

from services.vector_store_service import get_all_chunks


def bm25_search(
    question: str,
    k: int,
    workspace_id: str | None = None,
    filenames: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = get_all_chunks(workspace_id, filenames)
    if not rows:
        return []

    tokenized_docs = [_tokenize(row.get("content", "")) for row in rows]
    bm25 = BM25Okapi(tokenized_docs)
    scores = bm25.get_scores(_tokenize(question))

    results = []
    for row, score in zip(rows, scores):
        item = dict(row)
        item["bm25_score"] = float(score)
        results.append(item)

    return sorted(results, key=lambda item: item["bm25_score"], reverse=True)[:k]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())
